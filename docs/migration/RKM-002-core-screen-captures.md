# RKM-002 핵심 화면 캡처 (Desktop/Mobile)

캡처 일시:
- 2026-02-14

캡처 기준:
- 실제 코드(`app.js`, `style.css`, `index.html` 구조)를 사용
- Supabase 응답은 스냅샷 고정용 mock(`tools/snapshot/mock-supabase.js`)으로 주입
- 목적: 시각 기준선(Baseline) 확보, 데이터 변동/인증 상태에 영향받지 않는 재현성 보장

## 캡처 시나리오
- Login: 미로그인 상태
- Feed(Member): 일반 사용자 로그인 상태 + 게시글/댓글/RSVP 표시
- Admin Panel: 관리자(`swanston@roomingkos.com`) 로그인 상태 + 관리자 패널 오픈

## 데스크톱
- `docs/migration/screenshots/desktop-login.png`
- `docs/migration/screenshots/desktop-feed-member.png`
- `docs/migration/screenshots/desktop-admin-panel.png`

## 모바일
- `docs/migration/screenshots/mobile-login.png`
- `docs/migration/screenshots/mobile-feed-member.png`
- `docs/migration/screenshots/mobile-admin-panel.png`

## 재생성 방법

```bash
npx playwright screenshot --full-page --wait-for-timeout 1200 file:///Users/nmduk/PROJECTS/RK_Explore/tools/snapshot/login.html docs/migration/screenshots/desktop-login.png
npx playwright screenshot --full-page --wait-for-timeout 1400 file:///Users/nmduk/PROJECTS/RK_Explore/tools/snapshot/member.html docs/migration/screenshots/desktop-feed-member.png
npx playwright screenshot --full-page --wait-for-timeout 1800 file:///Users/nmduk/PROJECTS/RK_Explore/tools/snapshot/admin.html docs/migration/screenshots/desktop-admin-panel.png

npx playwright screenshot --full-page --device="iPhone 13" --wait-for-timeout 1200 file:///Users/nmduk/PROJECTS/RK_Explore/tools/snapshot/login.html docs/migration/screenshots/mobile-login.png
npx playwright screenshot --full-page --device="iPhone 13" --wait-for-timeout 1400 file:///Users/nmduk/PROJECTS/RK_Explore/tools/snapshot/member.html docs/migration/screenshots/mobile-feed-member.png
npx playwright screenshot --full-page --device="iPhone 13" --wait-for-timeout 1800 file:///Users/nmduk/PROJECTS/RK_Explore/tools/snapshot/admin.html docs/migration/screenshots/mobile-admin-panel.png
```
