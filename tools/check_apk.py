"""Periksa versi internal dan penanda deteksi APK sebelum dipublikasikan."""
import argparse
import json
import re
import struct
import zipfile


def inspect(path):
    with zipfile.ZipFile(path) as apk:
        manifest = apk.read('AndroidManifest.xml')
        strings = []
        result = {}
        pos = 8
        while pos < len(manifest):
            kind, header, size = struct.unpack_from('<HHI', manifest, pos)
            if kind == 1:
                count, _, flags, start = struct.unpack_from('<IIII', manifest, pos + 8)
                def length(offset, utf8):
                    unit = 1 if utf8 else 2
                    value = int.from_bytes(manifest[offset:offset + unit], 'little')
                    offset += unit
                    mask = 0x80 if utf8 else 0x8000
                    if value & mask:
                        value = ((value & (mask - 1)) << (unit * 8)) | int.from_bytes(manifest[offset:offset + unit], 'little')
                        offset += unit
                    return value, offset
                for i in range(count):
                    offset = pos + start + struct.unpack_from('<I', manifest, pos + header + i * 4)[0]
                    n, offset = length(offset, bool(flags & 256))
                    if flags & 256:
                        n, offset = length(offset, True)
                        strings.append(manifest[offset:offset + n].decode('utf-8'))
                    else:
                        strings.append(manifest[offset:offset + n * 2].decode('utf-16le'))
            elif kind == 0x102:
                if strings[struct.unpack_from('<I', manifest, pos + 20)[0]] == 'manifest':
                    attr_start, attr_size, count = struct.unpack_from('<HHH', manifest, pos + 24)
                    for i in range(count):
                        offset = pos + 16 + attr_start + i * attr_size
                        _, name, raw, _, _, typ, value = struct.unpack_from('<IIIHBBI', manifest, offset)
                        key = strings[name]
                        if key in ('versionName', 'versionCode', 'package'):
                            result[key] = strings[raw] if raw != 0xffffffff else strings[value] if typ == 3 else value
            pos += size
        dex = [apk.read(n) for n in apk.namelist() if re.fullmatch(r'classes\d*\.dex', n)]
        result['deteksi'] = {token: any(token.encode() in data for data in dex)
                             for token in ('KITO-Android', 'KitoAndroid', 'getAppVersion')}
        return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('apk', nargs='?', default='download/Dashboard-Kitov1.0.apk')
    args = parser.parse_args()
    info = inspect(args.apk)
    print(json.dumps(info, indent=2))
    if info.get('versionName') != '1.0' or info.get('versionCode') != 1:
        parser.exit(1, 'GAGAL: APK belum sesuai versi 1.0 (kode 1).\n')
