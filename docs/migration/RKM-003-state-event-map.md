# RKM-003 상태 전이 / 이벤트 맵

기준 소스:
- `/Users/nmduk/PROJECTS/RK_Explore/app.js`

## 1) 전역 상태 모델

```ts
state = {
  posts: PostViewModel[],
  user: {
    id: string,
    email: string,
    label: string,
    createdAt: string,
    isAdmin: boolean
  } | null,
  adminReports: Report[],
  adminLogs: AdminLog[]
}

ui = {
  currentSort: 'votes' | 'newest' | 'soonest',
  currentCategory: 'all' | Category,
  currentFeedFilter: 'all' | 'confirmed' | 'scheduled',
  currentSearch: string,
  showHiddenPosts: boolean,
  supportsPostStatus: boolean,
  supportsReportsTable: boolean,
  supportsAdminLogsTable: boolean,
  dataLoaded: boolean
}
```

## 2) 인증 상태 전이

- `INIT`
  - `auth.getSession()` 성공 + 세션 있음 -> `AUTHENTICATED`
  - 세션 없음 -> `UNAUTHENTICATED`
- `UNAUTHENTICATED`
  - 로그인 성공 + 이메일 인증됨 -> `AUTHENTICATED`
  - 로그인 성공 + 이메일 미인증 -> `UNAUTHENTICATED` (강제 signOut)
  - 회원가입 성공 -> `UNAUTHENTICATED` (인증 메일 안내)
- `AUTHENTICATED`
  - 로그아웃 성공 -> `UNAUTHENTICATED`

## 3) 피드 데이터 상태 전이

- `IDLE`
  - `initSupabase()` -> `LOADING`
- `LOADING`
  - `fetchAllPosts()` 성공 -> `READY`
  - `fetchAllPosts()` 실패 -> `ERROR`
- `READY`
  - 실시간 이벤트(`posts/votes/rsvps/comments`) -> `REFETCHING`
- `REFETCHING`
  - 최신 토큰 유효 + 성공 -> `READY`
  - 실패 -> `ERROR`
- `ERROR`
  - 재요청(수동/실시간 후속 이벤트) -> `LOADING` 또는 `REFETCHING`

## 4) RSVP 상태 전이 (사용자 관점)

- `NONE`
  - RSVP 클릭 + 마감 전 + 정원 미달 -> `GOING`
  - RSVP 클릭 + 마감 전 + 정원 초과 -> `WAITLISTED`
  - RSVP 클릭 + 마감 후 -> 전이 없음(토스트)
- `GOING`
  - RSVP 클릭 -> `NONE`
- `WAITLISTED`
  - RSVP 클릭 -> `NONE`
- 재계산 규칙
  - 같은 post의 RSVP 엔트리를 `created_at` 오름차순 정렬
  - `capacity` 앞 구간 = `GOING`, 이후 = `WAITLIST`
  - 취소 발생 시 대기열 선두가 자동 승격

## 5) 관리자 상태 전이

- `NON_ADMIN`
  - 이메일 != `swanston@roomingkos.com`
  - 관리자 토글/패널/액션 비노출
- `ADMIN_CLOSED`
  - 이메일 == 관리자 이메일, 패널 닫힘
  - 토글 클릭 -> `ADMIN_OPEN`
- `ADMIN_OPEN`
  - `loadAdminData()` 실행
  - 숨김글 토글/신고 큐 액션/로그 조회 가능
  - 토글 클릭 -> `ADMIN_CLOSED`

## 6) 이벤트 맵

| 이벤트 | 트리거 | 읽기/쓰기 | 후속 동작 |
|---|---|---|---|
| 로그인 | `member-login-btn` | `auth.signInWithPassword` | 유저 상태 설정, 앱 진입 |
| 회원가입 | `member-signup-btn` | `auth.signUp` | 인증 메일 안내 |
| 로그아웃 | `logout-btn` | `auth.signOut` | 상태 초기화 |
| 게시글 생성 | `submit-btn` | `posts.insert` | 폼 리셋, 토스트 |
| 투표 토글 | `.vote-btn` | `votes.insert/delete` | 실시간 재조회 반영 |
| RSVP 토글 | `.btn-rsvp` | `rsvps.insert/delete` | 실시간 재조회 반영 |
| 댓글 등록 | `.comment-submit`, Enter | `comments.insert` | 입력창 비움 |
| 신고 생성 | `.report-btn` | `post_reports.insert` | 관리자면 큐 재조회 |
| 작성자 확인 | `.btn-confirm` | `posts.update(status)` | 토스트 |
| 작성자 삭제 | `.delete-btn` | `posts.delete` | 토스트 |
| 관리자 숨김 | `.admin-hide-btn` | `posts.update(is_hidden...)` + `admin_action_logs.insert` | 필요시 report actioned |
| 관리자 숨김해제 | `.admin-unhide-btn` | `posts.update(unset hidden)` + `admin_action_logs.insert` | 관리자 데이터 재조회 |
| 관리자 삭제 | `.admin-delete-btn` | `posts.delete` + `admin_action_logs.insert` | 필요시 report actioned |
| 신고 기각 | `.admin-review-dismiss-btn` | `post_reports.update(dismissed)` + `admin_action_logs.insert` | 관리자 데이터 재조회 |
| 실시간 동기화 | Supabase channel | `posts/votes/rsvps/comments` 변경 수신 | `fetchAllPosts()` |

## 7) 파생 계산

- 필터: 카테고리 -> 피드필터 -> 숨김가시성 -> 검색
- 정렬: `votes/newest/soonest`
- 프로필 통계: `posts/votes/rsvps`에서 현재 사용자 기준 집계
- Admin 지표: `open reports`, `hidden posts`
