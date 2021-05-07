// @ts-ignore
import SHA1 from 'crypto-js/sha1';
import { uniqueId } from 'lodash';
import { Dirs, FileSystem } from 'react-native-file-access';

import { DownloadOptions } from './types';

const BASE_DIR = `${Dirs.CacheDir}/images_cache/`;

export class CacheEntry {
  source: string;

  options: DownloadOptions;

  cacheKey: string;

  downloadPromise: Promise<string | undefined> | undefined;

  pathResolved = false;

  constructor(source: string, options: DownloadOptions, cacheKey: string) {
    this.source = source;
    this.options = options;
    this.cacheKey = cacheKey;
  }

  async getPath(): Promise<string | undefined> {
    const { cacheKey } = this;
    const { path, exists, tmpPath } = await getCacheEntry(cacheKey);
    if (exists) {
      return path;
    }
    if (!this.downloadPromise) {
      this.pathResolved = false;
      this.downloadPromise = this.download(path, tmpPath);
    }

    if (this.downloadPromise && this.pathResolved) {
      this.pathResolved = false;
      this.downloadPromise = this.download(path, tmpPath);
    }
    return this.downloadPromise;
  }

  private async download(
    path: string,
    tmpPath: string
  ): Promise<string | undefined> {
    const { source, options } = this;
    if (source != null) {
      const result = await FileSystem.fetch(source, {
        path: tmpPath,
        ...options,
      });
      // If the image download failed, we don't cache anything
      if (result && result.status !== 200) {
        this.downloadPromise = undefined;
        return undefined;
      }
      await FileSystem.mv(tmpPath, path);
      this.pathResolved = true;
      return path;
    }
    return source;
  }
}

export default class CacheManager {
  static entries: { [uri: string]: CacheEntry } = {};

  /*   static get(
    source: ImageSource,
    options: DownloadOptions,
    cacheKey: string
  ): CacheEntry {
    if (!CacheManager.entries[cacheKey]) {
      CacheManager.entries[cacheKey] = new CacheEntry(source, options, cacheKey);
    }
    return CacheManager.entries[cacheKey];
  } */

  static get(
    source: string,
    options: DownloadOptions,
    cacheKey: string
  ): CacheEntry {
    if (!CacheManager.entries[cacheKey]) {
      CacheManager.entries[cacheKey] = new CacheEntry(
        source,
        options,
        cacheKey
      );
      return CacheManager.entries[cacheKey];
    }
    return CacheManager.entries[cacheKey];
  }

  static async clearCache(): Promise<void> {
    const files = await FileSystem.ls(BASE_DIR);
    for (const file of files) {
      try {
        await FileSystem.unlink(`${BASE_DIR}${file}`);
      } catch (e) {
        console.log(`error while clearing images cache, error: ${e}`);
      }
    }
  }

  static async getCacheSize(): Promise<number> {
    const result = await FileSystem.stat(BASE_DIR);
    if (!result) {
      throw new Error(`${BASE_DIR} not found`);
    }
    return result.size;
  }
}

const getCacheEntry = async (
  cacheKey: string
): Promise<{ exists: boolean; path: string; tmpPath: string }> => {
  const filename = cacheKey.substring(
    cacheKey.lastIndexOf('/'),
    cacheKey.indexOf('?') === -1 ? cacheKey.length : cacheKey.indexOf('?')
  );
  const ext =
    filename.indexOf('.') === -1
      ? '.jpg'
      : filename.substring(filename.lastIndexOf('.'));
  const sha = SHA1(cacheKey);
  const path = `${BASE_DIR}${sha}${ext}`;
  const tmpPath = `${BASE_DIR}${sha}-${uniqueId()}${ext}`;
  // TODO: maybe we don't have to do this every time
  try {
    await FileSystem.mkdir(BASE_DIR);
  } catch (e) {
    // do nothing
  }
  const exists = await FileSystem.exists(path);
  return { exists, path, tmpPath };
};
