#!/usr/bin/perl
# =====================================================================
# SSOL Knowledge Base — Excel → Supabase import SQL 생성기 (일회성, 재실행 가능)
#
# 사용법:
#   perl scripts/build_import_sql.pl <엑셀파일.xlsx> [출력폴더]
#
# 하는 일:
#   Excel의 각 시트를 읽어 "INSERT ... ON CONFLICT DO UPDATE"(upsert) SQL 파일을 만듭니다.
#   같은 ID가 이미 DB에 있으면 덮어쓰기(update), 없으면 새로 추가(insert)하므로
#   Excel을 고친 뒤 다시 실행해도 안전합니다.
#
# 설치할 것 없음: macOS에 기본 포함된 perl + unzip만 사용합니다.
# API 키를 사용하지 않습니다 (SQL 파일을 Supabase SQL Editor에 붙여넣는 방식).
# =====================================================================
use strict;
use warnings;
use utf8;
binmode(STDOUT, ':utf8');
binmode(STDERR, ':utf8');

my $xlsx = shift @ARGV or die "사용법: perl $0 <엑셀파일.xlsx> [출력폴더]\n";
my $outdir = shift @ARGV // 'supabase/import';
die "엑셀 파일을 찾을 수 없습니다: $xlsx\n" unless -f $xlsx;
system('mkdir', '-p', $outdir) == 0 or die "출력 폴더를 만들 수 없습니다: $outdir\n";

# ---------------------------------------------------------------------
# 1. xlsx 읽기 (xlsx는 zip 안의 XML 묶음)
# ---------------------------------------------------------------------
sub unzip_file {
    my ($member) = @_;
    my $cmd = "unzip -p " . shell_quote($xlsx) . " " . shell_quote($member) . " 2>/dev/null";
    my $data = `$cmd`;
    return undef if $? != 0;
    utf8::decode($data);
    return $data;
}
sub shell_quote { my $s = shift; $s =~ s/'/'\\''/g; return "'$s'"; }
sub xml_unescape {
    my $s = shift;
    $s =~ s/&lt;/</g; $s =~ s/&gt;/>/g; $s =~ s/&quot;/"/g; $s =~ s/&apos;/'/g;
    $s =~ s/&#(\d+);/chr($1)/ge; $s =~ s/&#x([0-9a-fA-F]+);/chr(hex($1))/ge;
    $s =~ s/&amp;/&/g;
    return $s;
}
sub col_index {   # "A"→0, "B"→1, "AA"→26
    my $n = 0;
    $n = $n * 26 + (ord($_) - 64) for split //, shift;
    return $n - 1;
}

my $workbook = unzip_file('xl/workbook.xml')        or die "xlsx를 읽을 수 없습니다 (workbook.xml)\n";
my $rels     = unzip_file('xl/_rels/workbook.xml.rels') or die "xlsx를 읽을 수 없습니다 (rels)\n";

my %target;
while ($rels =~ m{<(?:\w+:)?Relationship\s([^>]*?)/?>}g) {
    my $a = $1;
    my ($id) = $a =~ /\bId="([^"]*)"/;
    my ($tg) = $a =~ /\bTarget="([^"]*)"/;
    next unless defined $id && defined $tg;
    $tg =~ s{^/}{};
    $tg = "xl/$tg" unless $tg =~ m{^xl/};
    $target{$id} = $tg;
}

my @shared;
if (defined(my $ss = unzip_file('xl/sharedStrings.xml'))) {
    while ($ss =~ m{<(?:\w+:)?si>(.*?)</(?:\w+:)?si>}gs) {
        my $si = $1;
        $si =~ s{<(?:\w+:)?rPh\b.*?</(?:\w+:)?rPh>}{}gs;   # 발음 표기 제외
        my $t = '';
        $t .= $1 while $si =~ m{<(?:\w+:)?t\b[^>]*>(.*?)</(?:\w+:)?t>}gs;
        push @shared, xml_unescape($t);
    }
}

# sheets{시트이름} = [ [헤더...], {행 hash}, ... ]
my %sheets;
while ($workbook =~ m{<(?:\w+:)?sheet\s([^>]*?)/?>}g) {
    my $a = $1;
    my ($name) = $a =~ /\bname="([^"]*)"/;
    my ($rid)  = $a =~ /\br:id="([^"]*)"/;
    next unless defined $name && defined $rid && $target{$rid};
    $name = xml_unescape($name);
    my $xml = unzip_file($target{$rid}) // next;

    my @rows;
    while ($xml =~ m{<(?:\w+:)?row\b[^>]*>(.*?)</(?:\w+:)?row>}gs) {
        my $rowxml = $1;
        my @cells;
        while ($rowxml =~ m{<(?:\w+:)?c\s([^>]*?)(?:/>|>(.*?)</(?:\w+:)?c>)}gs) {
            my ($attr, $inner) = ($1, $2 // '');
            my ($ref) = $attr =~ /\br="([A-Z]+)\d+"/ or next;
            my ($type) = $attr =~ /\bt="([^"]*)"/;
            $type //= 'n';
            my $val = '';
            if ($type eq 's') {
                my ($i) = $inner =~ m{<(?:\w+:)?v>(.*?)</(?:\w+:)?v>};
                $val = defined $i ? ($shared[$i] // '') : '';
            } elsif ($type eq 'inlineStr') {
                $val .= $1 while $inner =~ m{<(?:\w+:)?t\b[^>]*>(.*?)</(?:\w+:)?t>}gs;
                $val = xml_unescape($val);
            } else {
                my ($v) = $inner =~ m{<(?:\w+:)?v>(.*?)</(?:\w+:)?v>};
                $val = defined $v ? xml_unescape($v) : '';
                $val = ($val eq '1') ? 'TRUE' : 'FALSE' if $type eq 'b';
            }
            $cells[col_index($ref)] = $val;
        }
        push @rows, \@cells;
    }
    next unless @rows;

    my $hdr = shift @rows;
    my @headers;
    for my $h (@$hdr) {          # 첫 빈 헤더에서 멈춤 (서식만 있는 빈 열 무시)
        last unless defined $h && $h =~ /\S/;
        (my $c = $h) =~ s/^\s+|\s+$//g;
        push @headers, $c;
    }
    my @recs;
    for my $r (@rows) {
        my %rec;
        for my $i (0 .. $#headers) {
            my $v = $r->[$i];
            $v = '' unless defined $v;
            $v =~ s/^\s+|\s+$//g;
            $rec{$headers[$i]} = $v;
        }
        next unless grep { $_ ne '' } values %rec;   # 완전히 빈 행 건너뜀
        push @recs, \%rec;
    }
    $sheets{$name} = { headers => \@headers, rows => \@recs };
}

# ---------------------------------------------------------------------
# 2. 시트 → 테이블 매핑
#    타입: t=글자  a=목록(text[], "a|b|c" 분리)  n=정수  b=참/거짓  j=steps(jsonb 목록)
# ---------------------------------------------------------------------
my @SPECS = (
  { sheet=>'articles', table=>'articles', key=>['article_id'], file=>1, cols=>[
      [article_id=>'t'],[title=>'t'],[author=>'t'],[source_type=>'t'],[primary_domain=>'a'],
      [primary_issues=>'a'],[wellness_themes=>'a'],[evidence_status=>'t'],[priority=>'t'],
      [persona_tags=>'a'],[human_handoff_summary=>'t'],[notes=>'t'] ] },
  { sheet=>'frameworks', table=>'frameworks', key=>['framework_id'], file=>1, cols=>[
      [framework_id=>'t'],[framework_name=>'t'],[purpose=>'t'],[steps=>'j'],[trigger_examples=>'a'],
      [linked_article_ids=>'a'],[persona_tags=>'a'],[usage_rule=>'t'],[priority=>'t'] ] },
  { sheet=>'question_library', table=>'question_library', key=>['question_id'], file=>1, cols=>[
      [question_id=>'t'],[framework_id=>'t'],[domain=>'a'],[issue_tags=>'a'],[wellness_theme=>'a'],
      [question_text=>'t'],[use_when=>'t'],[avoid_when=>'a'],[persona_tags=>'a'],[priority=>'t'] ] },
  { sheet=>'taxonomy', table=>'taxonomy', key=>['type','code'], file=>1, cols=>[
      [type=>'t'],[code=>'t'],[label_ko=>'t'],[description=>'t'],[examples=>'a'] ] },
  { sheet=>'system_prompt', table=>'system_prompt_sections', key=>['section_id'], file=>1, cols=>[
      [section_order=>'n'],[section_id=>'t'],[section_name=>'t'],[prompt_text=>'t'],
      [priority=>'t'],[implementation_note=>'t'] ] },
  { sheet=>'safety_rules', table=>'safety_rules', key=>['rule_id'], file=>1, cols=>[
      [rule_id=>'t'],[category=>'t'],[trigger=>'a'],[rule_text=>'t'],[priority=>'t'],
      [handoff_action=>'t'],[notes=>'t'] ] },
  { sheet=>'source_policy', table=>'source_policy', key=>['level'], file=>1, cols=>[
      [level=>'n'],[source_class=>'t'],[examples=>'t'],[allowed_use=>'t'],[attribution_rule=>'t'],
      [medical_use=>'t'],[numerical_claims=>'t'],[priority=>'t'] ] },
  { sheet=>'programs', table=>'programs', key=>['program_id'], file=>1, cols=>[
      [program_id=>'t'],[program_name=>'t'],[theoretical_base=>'a'],[primary_domain=>'a'],
      [target_user_signals=>'a'],[core_principle=>'t'],[possible_benefit_domains=>'a'],
      [linked_article_ids=>'a'],[linked_framework_ids=>'a'],[persona_tags=>'a'],[clinical_flag=>'t'],
      [doctor_referral_rule=>'t'],[evidence_status=>'t'],[source_reference=>'t'],[ai_usage_rule=>'t'],
      [do_not=>'a'],[service_type=>'t'],[active=>'b'] ] },
  { sheet=>'program_routing_rules', table=>'program_routing_rules', key=>['route_id'], file=>1, cols=>[
      [route_id=>'t'],[user_signal=>'a'],[primary_program_id=>'t'],[secondary_program_id=>'t'],
      [confidence_rule=>'t'],[safety_precheck=>'t'],[suggestion_language=>'t'],[do_not=>'t'],
      [priority=>'t'],[notes=>'t'] ] },
  { sheet=>'session_examples', table=>'session_examples', key=>['case_id'], file=>1, cols=>[
      [case_id=>'t'],[program_id=>'t'],[case_title=>'t'],[presenting_concern=>'t'],[initial_context=>'t'],
      [session_flow=>'a'],[session_goal=>'t'],[key_insights=>'t'],[behavioral_experiments=>'a'],
      [outcome_example=>'t'],[fictional_flag=>'b'],[ai_usage_rule=>'t'],[do_not=>'a'],
      [clinical_flag=>'t'],[source_note=>'t'],[priority=>'t'] ] },
  { sheet=>'service_knowledge', table=>'service_knowledge', key=>['service_id'], file=>1, cols=>[
      [service_id=>'t'],[service_topic=>'t'],[official_ai_statement=>'t'],[source_page=>'t'],
      [use_when=>'t'],[clinical_boundary=>'t'],[evidence_status=>'t'],[related_program_ids=>'a'],
      [allowed_claims=>'a'],[do_not=>'t'],[priority=>'t'],[notes=>'t'] ] },
  { sheet=>'brand_knowledge', table=>'brand_knowledge', key=>['brand_id'], file=>1, cols=>[
      [brand_id=>'t'],[concept=>'t'],[official_text=>'t'],[ai_interpretation=>'t'],[use_when=>'t'],
      [do_not=>'t'],[priority=>'t'],[notes=>'t'] ] },
  { sheet=>'response_routing', table=>'response_routes', key=>['route_order'], file=>1, cols=>[
      [route_order=>'n'],[intent_or_trigger=>'t'],[precheck=>'t'],[retrieval_scope=>'t'],[top_k=>'n'],
      [required_policy=>'a'],[response_mode=>'t'],[human_handoff=>'t'],[program_route=>'t'],
      [forbidden=>'a'],[example_output_goal=>'t'],[notes=>'t'] ] },
  { sheet=>'developer_config', table=>'app_config', key=>['config_key'], file=>1, cols=>[
      [config_key=>'t'],[value=>'t'],[type=>'t'],[description=>'t'],[implementation_note=>'t'] ] },
  { sheet=>'knowledge_chunks', table=>'knowledge_chunks', key=>['chunk_id'], file=>2, cols=>[
      [chunk_id=>'t'],[article_id=>'t'],[chunk_order=>'n'],[chunk_title=>'t'],[chunk_text=>'t'],
      [domain_tags=>'a'],[issue_tags=>'a'],[wellness_theme=>'a'],[persona_tags=>'a'],[use_when=>'t'],
      [follow_up_prompt=>'t'],[evidence_level=>'t'],[ai_attribution_rule=>'t'],[do_not=>'t'],
      [do_not_apply_when=>'a'],[priority=>'t'] ] },
);

# 필수(NOT NULL) 컬럼: 비어 있으면 생성 중단
my %REQUIRED = (
  articles => [qw(article_id title source_type evidence_status)],
  frameworks => [qw(framework_id framework_name steps)],
  question_library => [qw(question_id question_text)],
  taxonomy => [qw(type code label_ko)],
  system_prompt_sections => [qw(section_order section_id section_name prompt_text priority)],
  safety_rules => [qw(rule_id category trigger rule_text priority)],
  source_policy => [qw(level source_class allowed_use)],
  programs => [qw(program_id program_name clinical_flag evidence_status)],
  program_routing_rules => [qw(route_id user_signal primary_program_id safety_precheck)],
  session_examples => [qw(case_id program_id case_title fictional_flag ai_usage_rule)],
  service_knowledge => [qw(service_id service_topic official_ai_statement clinical_boundary)],
  brand_knowledge => [qw(brand_id concept official_text ai_interpretation)],
  response_routes => [qw(route_order intent_or_trigger retrieval_scope required_policy response_mode)],
  app_config => [qw(config_key value)],
  knowledge_chunks => [qw(chunk_id article_id chunk_text evidence_level)],
);

# ---------------------------------------------------------------------
# 3. SQL 값 변환
# ---------------------------------------------------------------------
sub sql_str { my $s = shift; $s =~ s/'/''/g; return "'$s'"; }
sub json_str {
    my $s = shift;
    $s =~ s/\\/\\\\/g; $s =~ s/"/\\"/g; $s =~ s/\n/\\n/g; $s =~ s/\r//g; $s =~ s/\t/\\t/g;
    return "\"$s\"";
}
sub sql_val {
    my ($v, $type) = @_;
    return 'null' if !defined $v || $v eq '';
    if ($type eq 't') { return sql_str($v); }
    if ($type eq 'n') {
        die "숫자가 아닌 값: '$v'\n" unless $v =~ /^-?\d+(?:\.0+)?$/;
        $v =~ s/\.0+$//;
        return $v;
    }
    if ($type eq 'b') {
        return 'true'  if $v =~ /^(?:TRUE|true|Y|y|1|예)$/;
        return 'false' if $v =~ /^(?:FALSE|false|N|n|0|아니오)$/;
        die "참/거짓으로 읽을 수 없는 값: '$v'\n";
    }
    if ($type eq 'a') {
        my @p = grep { $_ ne '' } split /\s*\|\s*/, $v;
        return 'null' unless @p;
        return 'array[' . join(',', map { sql_str($_) } @p) . ']::text[]';
    }
    if ($type eq 'j') {
        my @p = grep { $_ ne '' } split /\s*\|\s*/, $v;
        return '\'[' . join(',', map { my $j = json_str($_); $j =~ s/'/''/g; $j } @p) . ']\'::jsonb';
    }
    die "알 수 없는 타입 $type\n";
}

# ---------------------------------------------------------------------
# 4. 검증 + SQL 생성
# ---------------------------------------------------------------------
my @warnings;
my %ids;         # 테이블별 ID 집합 (FK 검사용)
my %counts;
my %body;        # file번호 → SQL 문
my %chunk_notes;
my %article_status = map { $_->{article_id} => $_->{evidence_status} } @{ $sheets{articles}{rows} };

sub warn_msg { push @warnings, shift; }

for my $spec (@SPECS) {
    my $sh = $sheets{ $spec->{sheet} } or die "엑셀에 '$spec->{sheet}' 시트가 없습니다.\n";
    my %have = map { $_ => 1 } @{ $sh->{headers} };
    for my $c (@{ $spec->{cols} }) {
        die "시트 '$spec->{sheet}'에 '$c->[0]' 컬럼이 없습니다. (엑셀 구조가 바뀌었는지 확인)\n"
            unless $have{ $c->[0] };
    }
    my @colnames = map { $_->[0] } @{ $spec->{cols} };
    my %type     = map { $_->[0] => $_->[1] } @{ $spec->{cols} };
    my ($cols_line, $update_line);
    my (%rowvals, @keyorder);

    for my $rec (@{ $sh->{rows} }) {
        my $keyval = join('/', map { $rec->{$_} } @{ $spec->{key} });
        for my $req (@{ $REQUIRED{ $spec->{table} } // [] }) {
            die "[$spec->{sheet}] '$keyval' 행의 필수 컬럼 '${req}' 가 비어 있습니다.\n" if $rec->{$req} eq '';
        }
        if (exists $rowvals{$keyval}) {
            warn_msg("[$spec->{sheet}] 중복 ID '$keyval' — 마지막 행이 최종 적용됩니다.");
        }
        $ids{ $spec->{table} }{$keyval} = 1;

        my @vals = map { sql_val($rec->{$_}, $type{$_}) } @colnames;
        my @update = map { "$_ = excluded.$_" } grep { my $c = $_; !grep { $_ eq $c } @{ $spec->{key} } } @colnames;
        my @cols_out = @colnames;

        if ($spec->{table} eq 'knowledge_chunks') {
            # 검증 전 chunk는 처음 넣을 때 검색에서 제외(is_active=false).
            # is_active는 update 대상에서 빼서, 재실행해도 수동 설정이 유지됩니다.
            # 결정(2026-09-21): ADHD·우울·공황 글의 chunk는 활성으로 import하고, 답변 시 전문가 상담 안내를 함께 한다.
            my $active = ($rec->{evidence_level} =~ /needs verification/i) ? 'false' : 'true';
            $chunk_notes{ $rec->{chunk_id} } = "chunk evidence_level = $rec->{evidence_level}" if $active eq 'false';
            push @vals, $active;
            push @cols_out, 'is_active';
            # chunk_text가 바뀌면 기존 embedding은 낡은 값이므로 비움 (M3에서 다시 생성).
            # Postgres는 SET 절에서 "변경 전" 값을 참조하므로 순서와 무관하게 안전합니다.
            push @update, "embedding = case when public.knowledge_chunks.chunk_text is distinct from excluded.chunk_text then null else public.knowledge_chunks.embedding end";
        }
        push @update, "updated_at = now()";

        push @keyorder, $keyval unless exists $rowvals{$keyval};
        $rowvals{$keyval} = "(" . join(', ', @vals) . ")";
        $cols_line = join(', ', @cols_out);
        $update_line = join(",\n  ", @update);
    }
    $counts{ $spec->{table} } = scalar @keyorder;
    # 표 하나당 INSERT 한 문장 (중복 ID는 위에서 제거됨). 파일이 작고 빠릅니다.
    $body{ $spec->{file} }{ $spec->{table} } =
          "insert into public.$spec->{table} ($cols_line)\nvalues\n  "
        . join(",\n  ", map { $rowvals{$_} } @keyorder) . "\n"
        . "on conflict (" . join(', ', @{ $spec->{key} }) . ") do update set\n  $update_line;\n";
}

# 외래키(연결) 검사: 잘못된 ID가 있으면 생성 중단
sub check_fk {
    my ($sheet, $col, $target, $optional) = @_;
    my ($spec) = grep { $_->{sheet} eq $sheet } @SPECS;
    for my $rec (@{ $sheets{$sheet}{rows} }) {
        my $v = $rec->{$col};
        next if $v eq '' && $optional;
        unless ($ids{$target}{$v}) {
            die "[$sheet] '$v' ($col)가 $target 시트에 없습니다.\n";
        }
    }
}
check_fk('knowledge_chunks', 'article_id', 'articles');
check_fk('program_routing_rules', 'primary_program_id', 'programs');
check_fk('program_routing_rules', 'secondary_program_id', 'programs', 1);
check_fk('session_examples', 'program_id', 'programs');
check_fk('question_library', 'framework_id', 'frameworks', 1);

# 정보성 점검: 임상 검토가 필요한 글의 chunk 수
my %needs;
for my $rec (@{ $sheets{knowledge_chunks}{rows} }) {
    my $st = $article_status{ $rec->{article_id} } // '';
    $needs{$st}{ $rec->{article_id} }++ if $st =~ /^Needs/i;
}

# ---------------------------------------------------------------------
# 5. 파일 쓰기
# ---------------------------------------------------------------------
sub header {
    my ($title) = @_;
    return "-- =====================================================================\n"
         . "-- $title\n"
         . "-- 자동 생성 파일입니다 (scripts/build_import_sql.pl). 직접 수정하지 마세요.\n"
         . "-- Supabase SQL Editor에 전체를 붙여넣고 Run 하세요. 여러 번 실행해도 안전합니다(upsert).\n"
         . "-- 전체가 하나의 트랜잭션이라 오류가 나면 아무것도 저장되지 않습니다.\n"
         . "-- =====================================================================\n\n";
}
sub write_file {
    my ($name, $content) = @_;
    open my $fh, '>:utf8', "$outdir/$name" or die "쓰기 실패: $outdir/$name\n";
    print $fh $content;
    close $fh;
    printf "  %s  (%.1f KB)\n", "$outdir/$name", (length(do { my $c = $content; utf8::encode($c); $c }) / 1024);
}

# 파일 1: 참조 테이블 전체 (FK 순서대로), 파일 2: knowledge_chunks
my @order1 = qw(articles frameworks question_library taxonomy system_prompt_sections safety_rules
                source_policy programs program_routing_rules session_examples service_knowledge
                brand_knowledge response_routes app_config);
my $f1 = header('SSOL import 1/2 — 참조 데이터 (articles, frameworks, programs, safety_rules 등)') . "begin;\n\n";
for my $t (@order1) {
    $f1 .= "-- ---- $t ($counts{$t}행) ----\n" . $body{1}{$t} . "\n";
}
$f1 .= "commit;\n";

my $f2 = header('SSOL import 2/2 — knowledge_chunks (import 1/2를 먼저 실행하세요)')
       . "begin;\n\n-- ---- knowledge_chunks ($counts{knowledge_chunks}행) ----\n"
       . $body{2}{knowledge_chunks} . "\ncommit;\n";

# 확인용 쿼리
my $check = header('SSOL import 확인 — 행 개수 (예상 개수와 비교)') . "select 'articles' as table_name, count(*) as rows from public.articles\n";
for my $t (grep { $_ ne 'articles' } @order1, 'knowledge_chunks') {
    $check .= "union all select '$t', count(*) from public.$t\n";
}
$check .= "order by 1;\n\n-- 예상 개수:\n";
$check .= join('', map { sprintf("--   %-24s %d\n", $_, $counts{$_}) } sort keys %counts);
$check .= "\n-- 임베딩 대기 중인 chunk (M3 전에는 전부 대기가 정상):\n"
        . "-- select count(*) filter (where embedding is null) as waiting, count(*) filter (where is_active) as active, count(*) as total from public.knowledge_chunks;\n";

print "생성된 파일:\n";
write_file('import_1_reference_data.sql', $f1);
write_file('import_2_knowledge_chunks.sql', $f2);
write_file('import_check.sql', $check);

print "\n시트별 행 수:\n";
printf "  %-24s %d\n", $_, $counts{$_} for sort keys %counts;

if (%chunk_notes) {
    print "\n[알림] 검증 전 chunk는 검색에서 제외(is_active=false)로 들어갑니다:\n";
    print "  $_  ($chunk_notes{$_})\n" for sort keys %chunk_notes;
}
if (%needs) {
    print "\n[알림] 글(article) 상태에 Needs 표시가 있지만 활성으로 들어가는 항목 (사용 여부를 검토하세요):\n";
    for my $st (sort keys %needs) {
        print "  \"$st\": " . join(', ', map { "$_($needs{$st}{$_} chunks)" } sort keys %{ $needs{$st} }) . "\n";
    }
}
if (@warnings) {
    print "\n[경고]\n";
    print "  $_\n" for @warnings;
}
print "\n완료.\n";
