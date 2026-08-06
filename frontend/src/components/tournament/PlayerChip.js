import React from 'react';

// Skill/gender colouring lives in App.css (.player-chip.m-AA etc) so the
// palette is themeable and not rebuilt as a new style object on every render.
function PlayerChip({ player, detailed }) {
  if (!detailed) {
    return <span>{player.name}</span>;
  }

  const gender = player.gender?.toLowerCase() === 'female' ? 'f' : 'm';
  const skill = player.skill_level || 'BB';

  return (
    <span
      className={`player-chip ${gender}-${skill}${player.is_setter ? ' is-setter' : ''}`}
      title={`${player.gender}, ${skill}${player.is_setter ? ', setter' : ''}`}
    >
      {player.name}
    </span>
  );
}

export function PlayerLegend() {
  const males = ['AA', 'A', 'BB', 'B'];
  const females = ['AA', 'A', 'BB', 'B'];

  return (
    <div className="legend">
      {males.map(s => (
        <span key={`m${s}`} className={`player-chip m-${s}`}>M-{s}</span>
      ))}
      <span className="legend-sep" />
      {females.map(s => (
        <span key={`f${s}`} className={`player-chip f-${s}`}>F-{s}</span>
      ))}
      <span className="legend-sep" />
      <span className="player-chip m-BB is-setter">Setter</span>
    </div>
  );
}

export default PlayerChip;
