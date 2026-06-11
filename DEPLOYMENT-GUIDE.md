# 청첩장 배포 및 연결 안내

## 1. Supabase 연결

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 프로젝트를 엽니다.
2. `SQL Editor`에서 확장형 폴더의 `supabase-setup.sql`을 실행합니다.
3. `Authentication > Providers > Anonymous Sign-Ins`를 켭니다.
4. `Project Settings > API Keys`에서 Project URL과 Publishable key를 확인합니다.
5. 기본형과 확장형 폴더의 `supabase-config.js`에 같은 Project URL과 Publishable key를 입력합니다.

Publishable key는 브라우저에 들어가도 되는 키입니다. `service_role` 또는 Secret key는 브라우저 파일에 넣으면 안 됩니다.

기존 프로젝트를 업데이트하는 경우에도 최신 `supabase-setup.sql`을 다시 실행합니다. 방명록 숨김 관리, 하객 사진·영상 업로드, 참석 여부 권한 보완과 메인 MP4/WebM/MOV 영상 업로드 허용이 함께 적용됩니다. 운영 중인 프로젝트에서 `mime type video/mp4 is not supported` 오류가 보이면 `supabase-guest-photo-policy-fix.sql`만 다시 실행해도 두 영상 버킷 정책을 빠르게 갱신할 수 있습니다.
git config --global user.name "jeonjiyeon"
## 2. Vercel CLI 설치

PowerShell에서 다음 명령을 실행합니다.

```powershell
npm install -g vercel
vercel login
```

## 3. 기본형 배포

```powershell
cd "C:\Users\zz30n\Downloads\모바일청첩장"
vercel --prod
```

처음 실행할 때 새 Vercel 프로젝트를 만들고, 예를 들어 프로젝트 이름을 `wedding-basic`으로 지정합니다.

Vercel Dashboard의 `Settings > Environment Variables`에 다음 값을 Production 환경으로 추가하고 다시 배포합니다.

```text
SUPABASE_URL
SUPABASE_ANON_KEY
```

## 4. 확장형 배포

```powershell
cd "C:\Users\zz30n\Downloads\모바일청첩장 - 확장기능"
vercel --prod
```

처음 실행할 때 별도 프로젝트를 만들고, 예를 들어 프로젝트 이름을 `wedding-extended`로 지정합니다.

Vercel Dashboard의 `Settings > Environment Variables`에 다음 값을 Production 환경으로 추가하고 다시 배포합니다.

```text
SUPABASE_URL
SUPABASE_ANON_KEY
OPENAI_API_KEY
OPENAI_MODEL
```

Gemini도 사용할 때만 다음 값을 추가합니다.

```text
GEMINI_API_KEY
GEMINI_MODEL
```

환경변수를 바꾸면 반드시 `vercel --prod`로 다시 배포합니다.

## 5. 통합 이동 사이트 배포

기본형과 확장형의 최종 주소가 생기면 `hub/site-links.js`의 두 주소를 수정합니다.

```js
window.WEDDING_SITE_LINKS = {
  basic: "https://wedding-basic.vercel.app/",
  extended: "https://wedding-extended.vercel.app/",
};
```

그 다음 통합 이동 사이트를 별도 프로젝트로 배포합니다.

```powershell
cd "C:\Users\zz30n\Downloads\모바일청첩장 - 확장기능\hub"
vercel --prod
```

예를 들어 프로젝트 이름을 `wedding-hub`로 지정합니다.

## 6. 최종 링크 5개

실제 프로젝트 이름을 지정한 뒤 아래 형식으로 링크가 완성됩니다.

```text
기본형 청첩장:          https://wedding-basic.vercel.app/
기본형 관리자:          https://wedding-basic.vercel.app/admin.html
확장형 청첩장:          https://wedding-extended.vercel.app/
확장형 일반관리자:      https://wedding-extended.vercel.app/admin.html
통합 이동 사이트:       https://wedding-hub.vercel.app/
```

Vercel에서 이미 사용 중인 프로젝트 이름이면 뒤에 다른 문자열을 붙여 새 이름을 정합니다.

## 7. 노출된 OpenAI API Key 교체

OpenAI API Key를 채팅에 입력했다면 기존 키는 폐기하고 새 키로 교체합니다.

1. [OpenAI API Keys](https://platform.openai.com/api-keys)에서 기존 키를 삭제합니다.
2. 새 Secret key를 발급합니다.
3. Vercel 확장형 프로젝트의 `Settings > Environment Variables`에서 `OPENAI_API_KEY` 값을 새 키로 교체합니다.
4. 새 키를 브라우저 코드, 문서, 채팅에 입력하지 않습니다.
5. 확장형을 다시 배포합니다.

Vercel Access Token 자체를 노출한 경우에는 [Vercel Tokens](https://vercel.com/account/tokens)에서도 기존 토큰을 삭제하고 새 토큰을 발급합니다.

## 8. 카카오톡 공유 이미지

확장형 일반관리자에서 `카카오톡 공유 대표 이미지 (세로 3:4 권장)`에 600 x 800px 비율 이미지를 등록하고 저장합니다.

카카오톡은 기존 공유 링크의 미리보기를 캐시할 수 있으므로, 변경 직후에는 이전 이미지가 잠시 남아 있을 수 있습니다.

현재 공유 버튼은 운영체제 공유창과 OG 메타데이터를 사용합니다. 카카오톡 카드의 버튼 구성까지 직접 고정하려면 별도로 Kakao SDK 기반 카카오톡 공유 템플릿을 연결해야 합니다.

### 카카오톡 세로 카드 공유 활성화

1. [Kakao Developers](https://developers.kakao.com/)에서 앱을 만듭니다.
2. `앱 > 플랫폼 키 > JavaScript 키`에서 JavaScript 키를 확인합니다.
3. 같은 화면의 `JavaScript SDK 도메인`과 `제품 링크 관리 > 웹 도메인`에 확장형 Vercel 주소를 등록합니다.
4. `kakao-config.js`의 `javascriptKey`에 JavaScript 키를 입력합니다.
5. 별도 공유 도메인을 사용한다면 `shareBaseUrl`에 공개 청첩장 주소를 입력합니다. 비워 두면 현재 접속 도메인을 사용합니다.
6. 확장형을 다시 배포합니다.

JavaScript 키는 브라우저에서 사용하는 공개 키입니다. REST API 키, Admin 키, OpenAI API Key를 입력하면 안 됩니다.

카카오 카드의 `위치 보기` 버튼은 공개 청첩장의 `#location` 섹션으로 이동합니다. 오시는 길 안의 지도 버튼에서 원하는 지도 앱을 선택할 수 있습니다.
