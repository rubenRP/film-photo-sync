declare module "piexifjs" {
  export interface ExifObject {
    "0th": Record<string | number, unknown>;
    Exif: Record<string | number, unknown>;
    GPS: Record<string | number, unknown>;
    Interop?: Record<string | number, unknown>;
    "1st": Record<string | number, unknown>;
    thumbnail: unknown;
  }

  function load(data: string): ExifObject;
  function dump(exifObj: ExifObject): string;
  function insert(exifBytes: string, jpegData: string): string;
  function remove(jpegData: string): string;

  const ImageIFD: Record<string, number>;
  const ExifIFD: Record<string, number>;
  const GPSIFD: Record<string, number>;
  const InteropIFD: Record<string, number>;

  export default {
    load,
    dump,
    insert,
    remove,
    ImageIFD,
    ExifIFD,
    GPSIFD,
    InteropIFD,
  };
}
