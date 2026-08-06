// 캐싱은 하지 않는 최소 서비스 워커. 목적은 오프라인 지원이 아니라 PWA
// 설치 자격(installability) 충족 — Chrome/Android는 fetch 핸들러가 있는
// 서비스 워커가 없으면 설치된 앱을 완전히 신뢰된 standalone(주소창 없음)
// 상태로 열어주지 않고, 대신 주소창이 보이는 축소된 형태로 여는 경우가 있다.
// 여기서는 아무것도 가로채지 않고 항상 네트워크로 그대로 보낸다 — 배포할
// 때마다 파일 해시가 바뀌는 SPA라 캐싱하면 옛 버전이 계속 보이는 문제가
// 생길 수 있어서 의도적으로 캐시를 두지 않는다.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // no-op: respondWith를 호출하지 않으면 브라우저가 평소대로 네트워크 요청을 처리한다.
})
