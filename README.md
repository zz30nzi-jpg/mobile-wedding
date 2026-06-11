# 예비 신혼부부를 위한 커스텀 모바일 청첩장

## 소개

개인 취향에 따라 커스텀하여 만들 수 있는 모바일 청첩장입니다.

신랑, 신부 정보와 예식 안내, 갤러리, 참석 여부, 계좌 안내, 교통 안내 등을 모바일 화면에 맞게 구성할 수 있습니다. 일반관리자는 청첩장 내용을 편집하고, 공개 청첩장은 저장된 테마와 레이아웃 템플릿을 그대로 반영합니다.

## 주요 기능

- 모바일 반응형 청첩장 페이지
- 일반관리자용 청첩장 편집 화면
- 메인 이미지, 갤러리, 프로필 이미지 업로드
- 참석 여부, 방명록, 하객 사진/영상 업로드
- 계좌번호 복사, 지도 링크, 교통/식장 안내
- Supabase 기반 사용자별 청첩장 데이터 저장
- AI 교통/식장 안내 생성 연동을 위한 서버 함수 구조

## 사용방법

### 1. 다운로드

```bash
git clone <repository-url>
cd <project-folder>
```

또는 GitHub의 `Code > Download ZIP`으로 다운로드한 뒤 압축을 해제합니다.

### 2. 실행방법

정적 파일 기반 프로젝트이므로 로컬 서버로 실행하는 것을 권장합니다.

```bash
python -m http.server 5500
```

브라우저에서 아래 주소를 엽니다.

```text
http://localhost:5500
```

관리자 화면은 아래 주소에서 확인할 수 있습니다.

```text
http://localhost:5500/admin.html
```

## 기본 설정

Supabase를 사용하려면 다음 파일과 SQL을 설정합니다.

- `supabase-config.js`: Supabase URL과 anon key 설정
- `supabase-setup.sql`: 테이블, 정책, Storage 버킷 설정

AI 기능을 사용하려면 배포 환경의 서버 환경변수에 API Key를 등록해야 합니다. API Key는 절대 브라우저에서 읽히는 JS 파일에 넣지 마세요.

## 보안 주의

이 저장소는 퍼블릭 저장소로 공개될 수 있으므로 다음 값은 커밋하지 마세요.

- Supabase `service_role` key
- OpenAI, Gemini 등 AI API Key
- Kakao, Naver OAuth Client Secret
- 실제 사용자 개인정보
- 실제 계좌번호, 연락처, 비공개 사진
- `.env`, `.env.local` 등 환경변수 파일

브라우저 코드에는 공개 가능한 값만 넣어야 합니다. 서버에서만 사용해야 하는 비밀키는 Vercel, Netlify, 서버 환경변수 등에 등록해 사용하세요.

## 파일 구조

```text
index.html                  청첩장 공개 페이지
admin.html                  일반관리자 페이지
app.js                      청첩장 화면 렌더링
admin.js                    관리자 화면 기능
design-system.js            테마/디자인 시스템
invitation-data.js          기본 청첩장 데이터
rsvp-storage.js             Supabase 저장/조회 연결
api/ai-design.js            AI 서버 함수
styles.css                  전체 스타일
supabase-setup.sql          Supabase 설정 SQL
```

## 배포

정적 파일과 서버 함수가 함께 동작해야 하므로 Vercel 같은 플랫폼을 사용할 수 있습니다.

배포 후 필요한 환경변수는 배포 플랫폼의 Environment Variables 메뉴에 등록합니다. 환경변수를 등록한 뒤에는 반드시 다시 배포해야 적용됩니다.

## 라이선스

이 프로젝트의 라이선스는 아직 지정되지 않았습니다.

저장소를 공개 배포하거나 다른 사람이 사용할 수 있게 하려면 `LICENSE` 파일을 추가하고, 원하는 라이선스를 명시하세요.
