export default function SecretLayerPanel({ layers }) {
  if (!layers?.length) return null
  return (
    <div className="card">
      <h4>나만 보는 비밀</h4>
      {layers.map((layer) => (
        <p key={layer.layer}>
          <span className="dim">[{layer.type}]</span> {layer.content}
        </p>
      ))}
    </div>
  )
}
