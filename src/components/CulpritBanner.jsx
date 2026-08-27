// 브리핑과 "내 역할" 모달에서 함께 쓰는 범인 여부 안내 배너 — 학생들이 자기가
// 범인인지 아닌지 텍스트만으로 유추하다 헷갈리는 일을 막는다. 절대 다른
// 플레이어에게 보이지 않는 본인 전용 화면에서만 렌더링해야 한다.
export default function CulpritBanner({ isCulprit }) {
  return isCulprit ? (
    <div
      style={{
        padding: '12px 14px', marginBottom: 14, borderRadius: 3,
        background: 'rgba(176,71,58,.16)', border: '1px solid var(--blood-light)',
        color: 'var(--blood-light)', fontWeight: 800, fontSize: 14,
      }}
    >
      ⚠ 당신은 범인입니다 — 정체를 들키지 않게 연기하세요. 이 사실은 절대 먼저 밝히지 마세요.
    </div>
  ) : (
    <div
      style={{
        padding: '12px 14px', marginBottom: 14, borderRadius: 3,
        background: 'rgba(201,162,39,.10)', border: '1px solid var(--line)',
        color: 'var(--ink)', fontWeight: 700, fontSize: 14,
      }}
    >
      당신은 범인이 아닙니다 — 하지만 당신에게도 들키고 싶지 않은 비밀이 있습니다.
    </div>
  )
}
