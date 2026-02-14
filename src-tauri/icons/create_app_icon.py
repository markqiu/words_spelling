import struct
import zlib
import math

def create_png(width, height, pixels, filename):
    """Create a PNG file from pixel data"""
    def png_chunk(chunk_type, data):
        chunk_len = struct.pack('>I', len(data))
        chunk_crc = struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)
        return chunk_len + chunk_type + data + chunk_crc
    
    signature = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'
        for x in range(width):
            idx = (y * width + x) * 4
            raw_data += bytes(pixels[idx:idx+4])
    
    compressed = zlib.compress(raw_data, 9)
    
    with open(filename, 'wb') as f:
        f.write(signature)
        f.write(png_chunk(b'IHDR', ihdr))
        f.write(png_chunk(b'IDAT', compressed))
        f.write(png_chunk(b'IEND', b''))
    print(f'Created {filename}')

def draw_rounded_rect(pixels, w, h, x, y, rw, rh, radius, color):
    """Draw a rounded rectangle"""
    for py in range(y, y + rh):
        for px in range(x, x + rw):
            # Check if inside rounded rectangle
            in_rect = True
            
            # Top-left corner
            if px < x + radius and py < y + radius:
                dist = math.sqrt((px - x - radius)**2 + (py - y - radius)**2)
                if dist > radius:
                    in_rect = False
            # Top-right corner
            elif px > x + rw - radius - 1 and py < y + radius:
                dist = math.sqrt((px - x - rw + radius)**2 + (py - y - radius)**2)
                if dist > radius:
                    in_rect = False
            # Bottom-left corner
            elif px < x + radius and py > y + rh - radius - 1:
                dist = math.sqrt((px - x - radius)**2 + (py - y - rh + radius)**2)
                if dist > radius:
                    in_rect = False
            # Bottom-right corner
            elif px > x + rw - radius - 1 and py > y + rh - radius - 1:
                dist = math.sqrt((px - x - rw + radius)**2 + (py - y - rh + radius)**2)
                if dist > radius:
                    in_rect = False
            
            if in_rect:
                idx = (py * w + px) * 4
                # Apply gradient
                t = (py - y) / rh
                for i, c in enumerate(color):
                    if isinstance(c, tuple):
                        # Gradient
                        pixels[idx + i] = int(c[0] + (c[1] - c[0]) * t)
                    else:
                        pixels[idx + i] = c

def draw_letter(pixels, w, h, letter, cx, cy, size, color):
    """Draw a simple block letter"""
    # Simple font for 'S'
    if letter == 'S':
        # Define S shape as a bitmap (8x10 grid scaled to size)
        s_shape = [
            "  ####  ",
            " #    # ",
            " #      ",
            "  ##    ",
            "    ##  ",
            "      # ",
            " #    # ",
            "  ####  ",
        ]
        cell_size = size // 8
        start_x = cx - size // 2
        start_y = cy - len(s_shape) * cell_size // 2
        
        for row_idx, row in enumerate(s_shape):
            for col_idx, char in enumerate(row):
                if char == '#':
                    py_start = start_y + row_idx * cell_size
                    py_end = py_start + cell_size
                    px_start = start_x + col_idx * cell_size
                    px_end = px_start + cell_size
                    
                    for py in range(max(0, py_start), min(h, py_end)):
                        for px in range(max(0, px_start), min(w, px_end)):
                            idx = (py * w + px) * 4
                            pixels[idx:idx+4] = color

def draw_pencil(pixels, w, h, cx, cy, size, color):
    """Draw a simple pencil icon"""
    # Pencil tip
    tip_h = size // 3
    body_h = size // 2
    width = size // 4
    
    # Draw pencil body (rectangle)
    start_y = cy - body_h // 2
    start_x = cx - width // 2
    
    for py in range(start_y, start_y + body_h):
        for px in range(start_x, start_x + width):
            if 0 <= px < w and 0 <= py < h:
                idx = (py * w + px) * 4
                pixels[idx:idx+4] = color
    
    # Draw pencil tip (triangle)
    tip_start_y = start_y + body_h
    for i in range(tip_h):
        y = tip_start_y + i
        row_width = width - (i * 2 * width // tip_h // 2)
        x_start = cx - row_width // 2
        for px in range(x_start, x_start + row_width):
            if 0 <= px < w and 0 <= y < h:
                idx = (y * w + px) * 4
                # Darker tip
                pixels[idx:idx+4] = (color[0]//2, color[1]//2, color[2]//2, 255)

def create_app_icon(size, filename):
    """Create the app icon"""
    pixels = [0] * (size * size * 4)
    
    # Background gradient (purple to blue)
    for y in range(size):
        for x in range(size):
            idx = (y * size + x) * 4
            
            # Calculate distance from center for rounded corners
            corner_radius = size // 5
            in_bounds = True
            
            # Check corners
            if x < corner_radius and y < corner_radius:
                if math.sqrt((x - corner_radius)**2 + (y - corner_radius)**2) > corner_radius:
                    in_bounds = False
            elif x >= size - corner_radius and y < corner_radius:
                if math.sqrt((x - size + corner_radius)**2 + (y - corner_radius)**2) > corner_radius:
                    in_bounds = False
            elif x < corner_radius and y >= size - corner_radius:
                if math.sqrt((x - corner_radius)**2 + (y - size + corner_radius)**2) > corner_radius:
                    in_bounds = False
            elif x >= size - corner_radius and y >= size - corner_radius:
                if math.sqrt((x - size + corner_radius)**2 + (y - size + corner_radius)**2) > corner_radius:
                    in_bounds = False
            
            if in_bounds:
                # Gradient from purple (#667eea) to blue (#764ba2)
                t = (x + y) / (2 * size)
                r = int(102 + (118 - 102) * t)
                g = int(126 + (75 - 126) * t)
                b = int(234 + (162 - 234) * t)
                pixels[idx:idx+4] = [r, g, b, 255]
            else:
                pixels[idx:idx+4] = [0, 0, 0, 0]
    
    # Draw white "S" letter
    center = size // 2
    letter_size = int(size * 0.55)
    white = [255, 255, 255, 255]
    draw_letter(pixels, size, size, 'S', center, center, letter_size, white)
    
    # Add a subtle underline accent
    accent_y = center + letter_size // 3
    accent_width = letter_size // 2
    accent_height = max(2, size // 20)
    accent_x = center - accent_width // 2
    
    for py in range(accent_y, accent_y + accent_height):
        for px in range(accent_x, accent_x + accent_width):
            if 0 <= px < size and 0 <= py < size:
                idx = (py * size + px) * 4
                # Check if we're not in transparent area
                if pixels[idx + 3] > 0:
                    pixels[idx:idx+4] = [255, 255, 255, 200]
    
    create_png(size, size, pixels, filename)

# Generate icons in various sizes
sizes = [
    (32, '32x32.png'),
    (64, '16x16@2x.png'),
    (128, '128x128.png'),
    (256, '256x256.png'),
    (512, '512x512.png'),
    (1024, '1024x1024.png'),
]

for size, filename in sizes:
    create_app_icon(size, filename)

# Create copies for macOS iconset naming convention
import shutil
shutil.copy('256x256.png', '128x128@2x.png')
shutil.copy('512x512.png', '256x256@2x.png')
shutil.copy('1024x1024.png', '512x512@2x.png')

print('\n✅ All icons created successfully!')
