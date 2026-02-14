# RKM-004 아키텍처 결정 문서 (React + TypeScript)

기준 날짜: 2026-02-14

## 목표
- Vanilla JS -> React + TypeScript 점진 전환
- 기능 패리티 100%
- RLS/실시간 동기화/운영자 권한 노출 정확성 유지

## 의사결정 요약

1. 점진 전환 단위
- 파일 단위 Big-bang 교체 금지
- 신규 React 앱은 `apps/web`에 병행 구축
- 기존 Vanilla 앱(`index.html`, `app.js`)은 컷오버 전까지 유지

2. 데이터 접근 계층
- Supabase 직접 호출을 컴포넌트에서 금지
- `src/services/*`로 API 모듈화
- 독립 쿼리는 `Promise.all` 병렬 처리 원칙 준수

3. 서버 상태
- TanStack Query를 단일 소스 오브 트루스로 사용
- Query Key는 도메인 기반으로 정규화
- mutation 후 invalidate 규칙을 중앙 정의

4. 실시간 전략
- Supabase realtime 채널 이벤트 수신
- 도메인별 `invalidateQueries`로 최신화
- 연결 상태는 전용 UI 상태(`online/offline/connecting`)로 분리

5. 권한/보안
- 관리자 식별은 `normalizeEmail(user.email) === 'swanston@roomingkos.com'`
- Admin UI/액션은 조건 불일치 시 렌더/호출 모두 차단
- DB RLS를 최종 권한 경계로 유지

6. 라우팅/로딩 전략
- `react-router-dom` 기반 app shell
- 무거운 운영자 UI는 `React.lazy` 지연 로딩
- Suspense fallback 제공

7. 컴포넌트 설계
- 불린 prop 폭증 방지: compound/context 기반 분해
- 도메인 단위 컴포넌트 묶음(`posts`, `comments`, `admin`, `auth`)
- 상태/액션 인터페이스를 훅으로 캡슐화

## 폴더 구조

```txt
apps/web/
  src/
    app/
      App.tsx
      providers/
      router/
    features/
      auth/
      feed/
      posts/
      votes/
      comments/
      rsvps/
      admin/
    services/
      supabase/
      posts/
      votes/
      comments/
      rsvps/
      reports/
      admin/
    lib/
      queryKeys.ts
      env.ts
      guards.ts
      formatters.ts
    types/
      domain.ts
```

## 상태 경계

- Server state: TanStack Query (`posts`, `votes`, `rsvps`, `comments`, `reports`, `adminLogs`)
- Session/auth state: Supabase auth + `AuthProvider`
- Pure UI state: 정렬/필터/검색/패널 토글/토스트

## Query Key 규칙

- `['posts', 'list']`
- `['votes', 'byPostIds', postIdsHash]`
- `['rsvps', 'byPostIds', postIdsHash]`
- `['comments', 'byPostIds', postIdsHash]`
- `['admin', 'reports']`
- `['admin', 'logs']`
- mutation 후 최소 범위 invalidate를 기본 정책으로 채택

## 전환 시퀀스

1. Auth -> Header/Profile
2. Post create -> Feed read
3. Vote/Comment
4. RSVP(waitlist/마감)
5. Sort/Filter/Search
6. Admin gate -> Admin queue/log/actions
7. 회귀/성능 점검 후 컷오버

## 위험요소 및 완화

- 스키마 드리프트: `supabase_schema.sql` 기준 사전 검증
- 권한 누락 노출: UI 게이트 + 서비스 함수 내부 관리자 체크 이중화
- 리얼타임 과잉 무효화: 테이블별 invalidate 범위 제한
- 번들 비대화: Admin route lazy split

## 컷오버 조건

- RKM-013~022 기능 패리티 완료
- lint/typecheck/build 통과
- 주요 플로우 수동 검증 완료
- 운영자 계정/일반 계정 권한 검증 완료
