import struct, zlib, math

def make_png(w, h, rgba_data):
    def chunk(ct, d):
        c = ct + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    raw = b''
    for y in range(h):
        raw += b'\x00'
        raw += rgba_data[y*w*4:(y+1)*w*4]
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

def gen_icon(sz):
    px = bytearray(sz * sz * 4)
    cx = sz / 2 - 0.5
    cy = sz / 2 + 0.5
    R = sz * 0.375
    thick = max(1.2, sz * 0.1)
    for y in range(sz):
        for x in range(sz):
            dx = x - cx
            dy = y - cy
            d = math.sqrt(dx * dx + dy * dy)
            ang = math.degrees(math.atan2(-dy, dx))
            a = 0
            # Arc
            if R - thick <= d <= R + thick and -10 <= ang <= 190:
                a = max(a, int(255 * max(0, 1 - abs(d - R) / thick)))
            # Needle
            na = math.radians(50)
            nx2 = math.cos(na)
            ny2 = -math.sin(na)
            proj = dx * nx2 + dy * ny2
            perp = abs(dx * (-ny2) + dy * nx2)
            nt = max(0.7, sz * 0.05)
            if 0 <= proj <= R * 0.75 and perp < nt and dy <= 1:
                a = max(a, int(255 * max(0, 1 - perp / nt)))
            # Center dot
            if d < sz * 0.1:
                a = max(a, int(255 * max(0, 1 - d / (sz * 0.1))))
            i = (y * sz + x) * 4
            px[i] = 0
            px[i+1] = 0
            px[i+2] = 0
            px[i+3] = min(255, a)
    return make_png(sz, sz, bytes(px))

with open('assets/tray-iconTemplate.png', 'wb') as f:
    f.write(gen_icon(16))
with open('assets/tray-iconTemplate@2x.png', 'wb') as f:
    f.write(gen_icon(32))
print('Icons generated successfully')
