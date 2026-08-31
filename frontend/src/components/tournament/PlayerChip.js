import React from 'react';

// Skill/gender colouring lives in App.css (.player-chip.m-AA etc) so the
// palette is themeable and not rebuilt as a new style object on every render.
// Passing onSelect turns the name into a button that opens that player's own
// schedule; without it the chip stays inert, which is what the legend and the
// printable sheet want.
function PlayerChip({ player, detailed, onSelect }) {
  const tappable = typeof onSelect === 'function';
  const open = () => onSelect(player);

  if (!detailed) {
    return tappable ? (
      <button type="button" className="player-link" onClick={open}>
        {player.name}
      </button>
    ) : (
      <span>{player.name}</span>
    );
  }

  const gender = player.gender?.toLowerCase() === 'female' ? 'f' : 'm';
  const skill = player.skill_level || 'BB';
  const className = `player-chip ${gender}-${skill}${player.is_setter ? ' is-setter' : ''}`;
  const title = `${player.gender}, ${skill}${player.is_setter ? ', setter' : ''}`;

  return tappable ? (
    <button
      type="button"
      className={`${className} is-tappable`}
      title={`${title} — tap for their schedule`}
      onClick={open}
    >
      {player.name}
    </button>
  ) : (
    <span className={className} title={title}>
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
