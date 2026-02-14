# RKM-024 배포 체크리스트 + 롤백 플랜

기준일: 2026-02-14
대상 앱: `/Users/nmduk/PROJECTS/RK_Explore/apps/web`

## 1) 컷오버 전 체크리스트

### 1-1. 코드/품질
- [ ] `main` 최신 pull 완료
- [ ] `npm ci` 완료
- [ ] `npm run check` 통과 (lint/typecheck/build)
- [ ] `npm run test:run` 통과
- [ ] `npm run perf:check` 결과 기록

### 1-2. DB/RLS
- [ ] Supabase SQL Editor에서 `/Users/nmduk/PROJECTS/RK_Explore/supabase_schema.sql` 최신 반영
- [ ] `posts` 확장 컬럼(`status/capacity/meetup_place/meeting_time/estimated_cost/prep_notes/rsvp_deadline/is_hidden/hidden_*`) 존재 확인
- [ ] `post_reports`, `admin_action_logs` 테이블 존재 확인
- [ ] RLS 정책 동작 확인
  - 일반 사용자: 숨김글 비가시
  - 작성자: 본인 숨김글 가시
  - 관리자(`swanston@roomingkos.com`): 숨김글/신고/로그 가시 및 조치 가능

### 1-3. 환경 변수
- [ ] `VITE_SUPABASE_URL` 설정
- [ ] `VITE_SUPABASE_ANON_KEY` 설정
- [ ] 운영자 이메일은 코드 하드고정(`swanston@roomingkos.com`) 확인

### 1-4. 사용자 플로우 사전 검증
- [ ] 로그인/회원가입/세션복원
- [ ] 글 작성/수정상태(Confirm)/삭제
- [ ] 투표 토글/댓글 작성
- [ ] RSVP 정원/대기열/마감
- [ ] 검색/정렬/필터
- [ ] 관리자 신고 큐/숨김/해제/삭제/기각 + 액션 로그

## 2) 컷오버 실행 순서

1. 현재 배포 버전 태깅
- 예: `git tag pre-react-cutover-YYYYMMDD-HHMM && git push origin --tags`

2. React 빌드 산출물 생성
- `cd /Users/nmduk/PROJECTS/RK_Explore/apps/web`
- `npm ci`
- `npm run check`
- `npm run test:run`
- `npm run build`

3. 배포 플랫폼 반영
- 배포 환경변수(2개) 설정 확인
- `dist` 기준으로 배포
- 헬스체크 통과 시 트래픽 전환

4. 컷오버 직후 스모크 체크 (15분)
- 일반 계정: 핵심 피드/액션 확인
- 관리자 계정: 신고 큐 조치 1건 end-to-end
- realtime 반영(투표/댓글/RSVP 변경 동기화) 확인

## 3) 롤백 플랜

롤백 트리거(하나라도 충족 시 즉시 롤백):
- 인증 불가/세션 무한 복원 실패
- 일반 사용자 권한에서 관리자 UI 노출
- 관리자 액션 불능 또는 로그 미기록
- 실시간 동기화 장애로 데이터 정합성 훼손

롤백 절차:
1. 트래픽을 직전 안정 배포(태그: `pre-react-cutover-*`)로 즉시 전환
2. React 신규 배포를 중지/비활성화
3. 장애 구간 로그 수집
  - 브라우저 콘솔 에러
  - Supabase 로그(Auth/PostgREST/Realtime)
4. 원인 수정 브랜치에서 패치 후 재검증
5. `npm run check && npm run test:run` 통과 후 재배포

DB 롤백 원칙:
- 본 전환은 앱 레이어 전환이므로 DB 스키마 롤백은 기본적으로 수행하지 않음
- 데이터 파괴 이슈 시에만 별도 복구 시나리오 적용

## 4) 완료 조건
- [ ] 컷오버 후 24시간 주요 장애 없음
- [ ] 운영자 모드 노출/권한 정확성 확인
- [ ] 신고/액션 로그 누락 없음
- [ ] 사용자 핵심 플로우 성공률 유지
