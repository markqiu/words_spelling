import struct
import zlib

def create_png(width, height, color, filename):
    def png_chunk(chunk_type, data):
        chunk_len = struct.pack('>I', len(data))
        chunk_crc = struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)
        return chunk_len + chunk_type + data + chunk_crc
    
    signature = b'\x89PNG\r\n\x1a\n'
    # Color type 6 = RGBA (was 2 = RGB)
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'
        for x in range(width):
            raw_data += bytes(color) + b'\xff'  # Add alpha channel
    compressed = zlib.compress(raw_data)
    
    with open(filename, 'wb') as f:
        f.write(signature)
        f.write(png_chunk(b'IHDR', ihdr))
        f.write(png_chunk(b'IDAT', compressed))
        f.write(png_chunk(b'IEND', b''))
    print(f'Created {filename}')

# Purple color #667eea (RGB)
color = (102, 126, 234)
create_png(32, 32, color, '32x32.png')
create_png(128, 128, color, '128x128.png')
create_png(256, 256, color, '128x128@2x.png')
print('Icons created successfully')
