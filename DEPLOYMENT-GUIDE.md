# 청첩장 배포 및 연결 안내

## 1. Supabase 연결

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 프로젝트를 엽니다.
2. `SQL Editor`에서 `supabase-setup.sql`을 실행합니다. 기존 프로젝트를 업데이트할 때도 최신 파일을 다시 실행하면 됩니다.
3. `Project Settings > API Keys`에서 Project URL과 Publishable key를 확인합니다.
4. 같은 값을 `supabase-config.js`(브라우저), `api/_lib/public-invitation.js`·`middleware.js`(서버, 기본값)에 넣거나 Vercel 환경변수 `SUPABASE_URL`·`SUPABASE_ANON_KEY`로 등록합니다.

Publishable key는 브라우저에 들어가도 되는 키입니다. `service_role` 또는 Secret key는 브라우저 파일에 넣으면 안 됩니다.

## 2. Vercel 환경변수

Vercel Dashboard의 `Settings > Environment Variables`에 Production 환경으로 추가합니다.

```text
SUPABASE_URL          (선택) 코드 기본값 대신 쓸 Supabase 주소
SUPABASE_ANON_KEY     (선택) 코드 기본값 대신 쓸 Publishable key
ANTHROPIC_API_KEY     관리자 AI 교통·식장 안내 생성에 필요 (기본 AI는 Claude)
ALLOWED_ORIGINS       (선택) AI 서버 함수를 부를 수 있는 주소 목록, 쉼표로 구분
```

환경변수를 바꾸면 반드시 다시 배포해야 적용됩니다.

## 3. 배포 흐름

GitHub `main`에 push하면 Vercel이 자동으로 배포합니다.

- Vercel이 Hobby 플랜이고 저장소가 비공개라, 저장소 주인이 아닌 계정이 만든 커밋은 배포가 막힐 수 있습니다. 이때는 저장소 주인 계정으로 GitHub 웹에서 커밋을 하나 더 만들면(예: README 수정) 배포됩니다.
- push하기 전에는 `git pull`로 원격의 새 커밋을 먼저 받습니다.

## 4. 캐시 버전(`?v=`) 규칙

`vercel.json`은 `?v=`가 붙은 js·css를 휴대폰에 7일간 저장하고, 버전 없는 요청만 매번 확인합니다.

- js·css 파일을 고치면 `index.html`과 `admin.html`에서 그 파일의 `?v=` 값을 둘 다 올립니다.
- 관리자 편집 미리보기 iframe 주소(`admin.js`의 `index.html?copyEditorPreview=1&v=`)도 함께 올립니다.
- `source/backgrounds/*` 이미지는 1년 캐시라, 같은 이름으로 바꿀 때는 그 이미지를 쓰는 곳의 `?v=`를 올립니다.

## 5. 로컬 실행

```bash
node local-server.js
```

기본 포트는 5500이고 `PORT` 환경변수로 바꿀 수 있습니다. `/api/*` 서버 함수도 함께 동작합니다. `middleware.js`(첫 화면 배경색·공유 태그를 HTML에 미리 넣음)는 Vercel에서만 동작합니다.

## 6. 카카오톡 공유

1. [Kakao Developers](https://developers.kakao.com/)에서 앱을 만듭니다.
2. `앱 > 플랫폼 키 > JavaScript 키`에서 JavaScript 키를 확인합니다.
3. 같은 화면의 `JavaScript SDK 도메인`과 `제품 링크 관리 > 웹 도메인`에 배포 주소를 등록합니다.
4. `kakao-config.js`의 `javascriptKey`에 JavaScript 키를 입력합니다.
5. 별도 공유 도메인을 사용한다면 `shareBaseUrl`에 공개 청첩장 주소를 입력합니다. 비워 두면 현재 접속 도메인을 사용합니다.

JavaScript 키는 브라우저에서 사용하는 공개 키입니다. REST API 키, Admin 키, AI API Key를 입력하면 안 됩니다.

공유 카드 사진은 관리자 `공유` 탭에서 고릅니다(비워 두면 메인 사진). 카카오톡은 미리보기를 캐시하므로 바꾼 직후에는 이전 사진이 잠시 보일 수 있습니다.

카카오 카드의 `위치 보기` 버튼은 `/api/map`을 거쳐 예식장 주소의 지도 검색으로 연결됩니다.
