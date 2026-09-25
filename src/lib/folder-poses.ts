export interface CardSize { width: number; height: number; kind: 'note' | 'photo'; }
export interface CardPose { x: number; y: number; rotation: number; scale: number; opacity: number; }

export function stagePoses(cards: CardSize[], active: number, width: number, height: number): CardPose[] {
  if (!cards.length) return [];
  const mobile = width <= 540;
  const unit = Math.min(width * (mobile ? .76 : .46), height * .52);
  const readingHeight = Math.min(height * .82, height - (mobile ? 174 : 150));
  const readingWidth = mobile ? width - 56 : Math.min(width * .6, 480);
  const fit = (card: CardSize, index: number) => index === active && card.kind === 'note'
    ? Math.min(readingWidth / card.width, readingHeight / card.height)
    : unit / Math.max(card.width, card.height) * (index === active ? 1 : .6);
  const reach = fit(cards[active], active) * cards[active].width / 2 + unit * .08 + unit * .6 / 2;
  return cards.map((card, index) => {
    const distance = index - active;
    const hash = Math.sin((index + 1) * 127.1) * 43758.5453;
    return {
      x: width / 2 + (distance ? Math.sign(distance) * (reach + (Math.abs(distance) - 1) * unit * .68) : 0),
      y: height / 2,
      rotation: distance ? (hash - Math.floor(hash)) * 12 - 6 : 0,
      scale: fit(card, index),
      opacity: Math.max(.3, 1 - Math.abs(distance) * .16),
    };
  });
}

export function gridPoses(cards: CardSize[], width: number): { poses: CardPose[]; height: number } {
  if (!cards.length) return { poses: [], height: 0 };
  const columns = width >= 760 ? 3 : width >= 280 ? 2 : 1;
  const padding = Math.min(width * .06, 28);
  const gap = Math.min(width * .05, 24);
  const cellWidth = (width - padding * 2 - gap * (columns - 1)) / columns;
  const rotations = [-5, 4, -3, 5.5, -4.5, 3.5];
  const sizes = [.94, 1, .9, .98, .92, .96];
  const offsets = [.02, .16, .07, .12, 0, .18];
  const shifts = [-.3, .3, -.15, .3, -.25, .15];
  const poses: CardPose[] = [];
  let rowTop = padding;

  for (let start = 0; start < cards.length; start += columns) {
    const count = Math.min(columns, cards.length - start);
    const rowLeft = (width - (cellWidth * count + gap * (count - 1))) / 2;
    let rowHeight = 0;

    for (let column = 0; column < count; column++) {
      const index = start + column;
      const card = cards[index];
      const pattern = index % rotations.length;
      const rotation = rotations[pattern];
      const angle = Math.abs(rotation) * Math.PI / 180;
      const rotatedWidth = card.width * Math.cos(angle) + card.height * Math.sin(angle);
      const rotatedHeight = card.height * Math.cos(angle) + card.width * Math.sin(angle);
      const scale = cellWidth * sizes[pattern] / rotatedWidth;
      const boundsWidth = rotatedWidth * scale;
      const boundsHeight = rotatedHeight * scale;
      const offset = cellWidth * offsets[pattern];

      poses.push({
        x: rowLeft + column * (cellWidth + gap) + cellWidth / 2 + (cellWidth - boundsWidth) * shifts[pattern],
        y: rowTop + offset + boundsHeight / 2,
        rotation,
        scale,
        opacity: 1,
      });
      rowHeight = Math.max(rowHeight, offset + boundsHeight);
    }

    rowTop += rowHeight + gap;
  }

  return { poses, height: rowTop - gap + padding };
}
