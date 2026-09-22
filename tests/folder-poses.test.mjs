import test from 'node:test';
import assert from 'node:assert/strict';
import { gridPoses, stagePoses } from '../src/lib/folder-poses.ts';

const cards = [
  { width: 108, height: 166, kind: 'note' },
  { width: 132, height: 99, kind: 'photo' },
  { width: 114, height: 152, kind: 'photo' },
];

test('selected manuscript fits narrow and wide viewports with room for controls', () => {
  for (const [width, height] of [[375, 812], [768, 1024], [1280, 960], [812, 375]]) {
    const pose = stagePoses(cards, 0, width, height)[0];
    assert.equal(pose.x, width / 2);
    assert.equal(pose.y, height / 2);
    assert.equal(pose.rotation, 0);
    assert.ok(cards[0].width * pose.scale < width);
    assert.ok(cards[0].height * pose.scale <= height * .82 + .1);
  }
});

test('changing selection centers the target and separates smaller side cards', () => {
  for (const active of [0, 1, 2]) {
    const poses = stagePoses(cards, active, 1280, 960);
    const selected = poses[active];
    assert.equal(selected.x, 640);
    for (let i = 0; i < poses.length; i++) {
      if (i === active) continue;
      const cardHalfWidth = cards[i].width * poses[i].scale / 2;
      const activeHalfWidth = cards[active].width * selected.scale / 2;
      assert.ok(Math.abs(poses[i].x - selected.x) > cardHalfWidth + activeHalfWidth);
      assert.equal(Math.sign(poses[i].x - selected.x), Math.sign(i - active));
      assert.ok(poses[i].opacity < selected.opacity);
    }
  }
});

test('zero and one item collections stay valid without phantom cards', () => {
  assert.deepEqual(stagePoses([], 0, 375, 812), []);
  assert.equal(stagePoses(cards.slice(0, 1), 0, 375, 812).length, 1);
  assert.deepEqual(stagePoses(cards, 1, 1280, 960), stagePoses(cards, 1, 1280, 960));
});

function bounds(card, pose) {
  const angle = Math.abs(pose.rotation) * Math.PI / 180;
  const width = (card.width * Math.cos(angle) + card.height * Math.sin(angle)) * pose.scale;
  const height = (card.height * Math.cos(angle) + card.width * Math.sin(angle)) * pose.scale;
  return { left: pose.x - width / 2, right: pose.x + width / 2, top: pose.y - height / 2, bottom: pose.y + height / 2 };
}

const photos = [
  { width: 140, height: 100, kind: 'photo' },
  { width: 100, height: 150, kind: 'photo' },
  { width: 140, height: 90, kind: 'photo' },
  { width: 120, height: 120, kind: 'photo' },
  { width: 150, height: 90, kind: 'photo' },
  { width: 100, height: 135, kind: 'photo' },
  { width: 100, height: 200, kind: 'photo' },
];

test('spread photos stay inside the canvas without overlapping at narrow and wide widths', () => {
  for (const width of [240, 280, 343, 720, 759, 760, 900]) {
    const { poses, height } = gridPoses(photos, width);
    assert.equal(poses.length, photos.length);
    const boxes = poses.map((pose, index) => {
      assert.equal(pose.opacity, 1);
      assert.ok(pose.scale > 0);
      const box = bounds(photos[index], pose);
      assert.ok(box.left > 0 && box.right < width, `horizontal bounds at ${width}`);
      assert.ok(box.top > 0 && box.bottom < height, `vertical bounds at ${width}`);
      return box;
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        assert.ok(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top, `cards ${i} and ${j} overlap at ${width}`);
      }
    }
  }
});

test('spread photos use two columns on phones and three on large viewports with repeatable variation', () => {
  for (const [width, columns] of [[343, 2], [900, 3]]) {
    const layout = gridPoses(photos, width);
    assert.deepEqual(layout, gridPoses(photos, width));
    const boxes = layout.poses.map((pose, index) => bounds(photos[index], pose));
    for (let i = 1; i < columns; i++) assert.ok(boxes[i].left > boxes[i - 1].right);
    assert.ok(boxes[columns].top > Math.max(...boxes.slice(0, columns).map(box => box.bottom)));
    assert.notEqual(boxes[0].top, boxes[1].top);
    assert.notEqual(boxes[0].right - boxes[0].left, boxes[1].right - boxes[1].left);
    assert.ok(layout.poses.some(pose => pose.rotation < 0));
    assert.ok(layout.poses.some(pose => pose.rotation > 0));
  }
});

test('empty and single-photo spreads have no unused rows', () => {
  assert.deepEqual(gridPoses([], 343), { poses: [], height: 0 });
  for (const width of [343, 900]) {
    const { poses, height } = gridPoses(photos.slice(0, 1), width);
    assert.equal(poses.length, 1);
    const box = bounds(photos[0], poses[0]);
    assert.ok(box.left > width * .2 && box.right < width * .8);
    assert.ok(height - box.bottom <= 28);
  }
});
