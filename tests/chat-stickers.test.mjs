import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { CHAT_STICKERS, stickerMessage, messageSticker, stickerSource, isUploadedSticker } from '../src/lib/chat/stickers.ts';

test('cada sticker enviado se recupera del mensaje y tiene su imagen local', async () => {
  for (const sticker of CHAT_STICKERS) {
    assert.equal(messageSticker(stickerMessage(sticker.id)), sticker);
    await access(new URL(`../public${stickerSource(sticker)}`, import.meta.url));
  }
});

test('el texto normal, los códigos desconocidos y las rutas externas no se interpretan como stickers', () => {
  assert.equal(messageSticker('Hola [[conecta-sticker:listo]]'), undefined);
  assert.equal(messageSticker('[[conecta-sticker:https://externo.test/a.svg]]'), undefined);
  assert.equal(messageSticker('[[conecta-sticker:no-existe]]'), undefined);
  assert.throws(() => stickerMessage('../secreto'));
});

test('los stickers subidos se distinguen de imágenes normales sin aceptar HTML o SVG', () => {
  assert.equal(isUploadedSticker({ filename: 'sticker-saludo.webp', mime: 'image/webp' }), true);
  assert.equal(isUploadedSticker({ filename: 'sticker-animado.gif', mime: 'image/gif' }), true);
  assert.equal(isUploadedSticker({ filename: 'foto.png', mime: 'image/png' }), false);
  assert.equal(isUploadedSticker({ filename: 'sticker-archivo.svg', mime: 'image/svg+xml' }), false);
  assert.equal(isUploadedSticker({ filename: 'sticker-archivo.html', mime: 'text/html' }), false);
});
