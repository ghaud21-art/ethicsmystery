export default function CharacterSheet({ character }) {
  if (!character) return null
  return (
    <div className="card">
      <h3>
        {character.name} <span className="dim">· {character.role}</span>
      </h3>
      <p>{character.publicInfo}</p>
      <p className="dim">{character.detailInfo}</p>
      <div className="row">
        <span className="dim">협력: {character.cooperationIncentive}</span>
      </div>
      <div className="row">
        <span className="dim">경쟁: {character.competitionIncentive}</span>
      </div>
    </div>
  )
}
