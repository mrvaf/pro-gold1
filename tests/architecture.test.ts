import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Architecture & Monorepo Boundaries', () => {
  const rootDir = path.resolve(__dirname, '..');
  const coreSrcDir = path.resolve(rootDir, 'packages/core/src');

  const getAllFiles = (dir: string, ext = '.ts'): string[] => {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getAllFiles(filePath, ext));
      } else if (filePath.endsWith(ext)) {
        results.push(filePath);
      }
    }
    return results;
  };

  it('ensures @v-gold/core has ZERO imports of React or Next.js', () => {
    const coreFiles = getAllFiles(coreSrcDir);
    expect(coreFiles.length).toBeGreaterThan(0);

    const forbiddenPatterns = [
      /from ['"]react['"]/,
      /from ['"]react-dom['"]/,
      /from ['"]next/,
      /require\(['"]react['"]\)/,
      /require\(['"]next/,
    ];

    for (const file of coreFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        expect(
          pattern.test(content),
          `Core file ${path.relative(rootDir, file)} must not import UI/Next.js (matched ${pattern})`
        ).toBe(false);
      }
    }
  });

  it('ensures @v-gold/core has ZERO imports of database drivers or ORMs (Drizzle, PG, SQLite)', () => {
    const coreFiles = getAllFiles(coreSrcDir);
    const forbiddenPatterns = [
      /from ['"]drizzle-orm/,
      /from ['"]pg['"]/,
      /from ['"]postgres['"]/,
      /from ['"]mysql/,
      /from ['"]better-sqlite3['"]/,
    ];

    for (const file of coreFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        expect(
          pattern.test(content),
          `Core file ${path.relative(rootDir, file)} must not import database libraries (matched ${pattern})`
        ).toBe(false);
      }
    }
  });

  it('ensures @v-gold/core has ZERO imports of AI provider SDKs (Anthropic, OpenAI, etc.)', () => {
    const coreFiles = getAllFiles(coreSrcDir);
    const forbiddenPatterns = [
      /from ['"]@anthropic-ai\/sdk/,
      /from ['"]openai['"]/,
      /from ['"]@google\/generative-ai/,
      /from ['"]@langchain/,
    ];

    for (const file of coreFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        expect(
          pattern.test(content),
          `Core file ${path.relative(rootDir, file)} must not import AI provider SDKs (matched ${pattern})`
        ).toBe(false);
      }
    }
  });

  it('ensures @v-gold/core package.json dependencies are strictly domain-only', () => {
    const corePkgPath = path.resolve(rootDir, 'packages/core/package.json');
    const corePkg = JSON.parse(fs.readFileSync(corePkgPath, 'utf-8'));
    const dependencies = Object.keys(corePkg.dependencies ?? {});

    const prohibitedPackages = [
      'react',
      'react-dom',
      'next',
      'drizzle-orm',
      'pg',
      'openai',
      '@anthropic-ai/sdk',
      '@v-gold/database',
      '@v-gold/ai-gateway',
      '@v-gold/web',
    ];

    for (const pkg of prohibitedPackages) {
      expect(
        dependencies.includes(pkg),
        `@v-gold/core package.json must not list ${pkg} as a dependency`
      ).toBe(false);
    }
  });

  it('ensures @v-gold/ai-gateway does not depend on @v-gold/database or apps/web', () => {
    const aiPkgPath = path.resolve(rootDir, 'packages/ai-gateway/package.json');
    const aiPkg = JSON.parse(fs.readFileSync(aiPkgPath, 'utf-8'));
    const dependencies = Object.keys(aiPkg.dependencies ?? {});

    expect(dependencies.includes('@v-gold/database')).toBe(false);
    expect(dependencies.includes('@v-gold/web')).toBe(false);
    expect(dependencies.includes('@v-gold/core')).toBe(true);
  });

  it('ensures @v-gold/database does not depend on @v-gold/ai-gateway or apps/web', () => {
    const dbPkgPath = path.resolve(rootDir, 'packages/database/package.json');
    const dbPkg = JSON.parse(fs.readFileSync(dbPkgPath, 'utf-8'));
    const dependencies = Object.keys(dbPkg.dependencies ?? {});

    expect(dependencies.includes('@v-gold/ai-gateway')).toBe(false);
    expect(dependencies.includes('@v-gold/web')).toBe(false);
    expect(dependencies.includes('@v-gold/core')).toBe(true);
  });

  it('ensures apps/web depends on @v-gold/core, @v-gold/database, and @v-gold/ai-gateway', () => {
    const webPkgPath = path.resolve(rootDir, 'apps/web/package.json');
    const webPkg = JSON.parse(fs.readFileSync(webPkgPath, 'utf-8'));
    const dependencies = Object.keys(webPkg.dependencies ?? {});

    expect(dependencies.includes('@v-gold/core')).toBe(true);
    expect(dependencies.includes('@v-gold/database')).toBe(true);
    expect(dependencies.includes('@v-gold/ai-gateway')).toBe(true);
  });
});
