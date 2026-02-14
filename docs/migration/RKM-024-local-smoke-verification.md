# RKM-024 로컬 실행 스모크 검증

실행일: 2026-02-14

## 실행 환경
- 프로젝트: `/Users/nmduk/PROJECTS/RK_Explore/apps/web`
- 실행 명령:
  - `VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run dev -- --host 127.0.0.1 --port 4173`

## 검증 항목
1. Dev server 부팅
- 결과: `http://127.0.0.1:4173/` 정상 응답(HTTP 200)

2. 인증 라우트 진입
- 검증: `/` 접근 시 인증 UI(`Log In`) 렌더 확인
- 산출물: `docs/migration/screenshots/local-smoke-root.png`

3. 인증 페이지 직접 접근
- 검증: `/auth` 접근 시 로그인 폼 렌더 확인
- 산출물: `docs/migration/screenshots/local-smoke-auth.png`

4. 관리자 경로 보호
- 검증: `/admin` 접근 시 인증 페이지로 리다이렉트되어 `Log In` UI 노출
- 산출물: `docs/migration/screenshots/local-smoke-admin-redirect.png`

## 결론
- 로컬 실행/라우팅/기본 인증 가드 동작 정상
- 서버 종료 확인(종료 후 `http://127.0.0.1:4173/` 응답 코드 `000`)
