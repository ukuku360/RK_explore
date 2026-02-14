# RKM-023 회귀 테스트 / 성능 점검 보고

기준일: 2026-02-14
대상: `/Users/nmduk/PROJECTS/RK_Explore/apps/web`

## 1) 회귀 테스트 실행

실행 명령:
- `npm run test:run`

결과:
- Test Files: 3 passed
- Tests: 8 passed
- 검증 영역:
  - 관리자 이메일 하드 게이트(`isAdminEmail`)
  - RSVP 대기열/순번/마감 계산(`getRsvpSummary`, `isRsvpClosed`)
  - Query invalidation 규칙(변경/실시간 테이블 이벤트 매핑)

## 2) 정적 품질 게이트

실행 명령:
- `npm run check`

결과:
- `lint/typecheck/build` 모두 통과
- production build 성공

## 3) 성능 점검 (번들)

실행 명령:
- `npm run perf:check`

측정 결과:
- JS total: 457.64 kB
- CSS total: 7.05 kB
- Largest JS chunk: `index-DaXieRPR.js` (451.06 kB)
- Admin lazy chunk: `AdminPage-Df70jFTu.js` (6.59 kB)

해석:
- 운영자 화면은 lazy chunk로 분리되어 기본 사용자 진입 번들에 직접 포함되지 않음.
- 향후 최적화 우선순위는 메인 chunk(`index-*.js`) 축소.

## 4) 실시간 점검

검증 방식:
- 단위 테스트에서 realtime table -> query invalidation 매핑 검증
- `posts/votes/rsvps/comments`는 feed read-model invalidation
- `post_reports/admin_action_logs`는 moderation read-model invalidation

상태:
- 규칙 기반 실시간 갱신 경로 정상
