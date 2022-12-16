#! /usr/bin/env node

import fs from "fs";
import { sum } from "lodash";
import path from "path";

const base = process.cwd();
const readDir = (pathString: string) => {
  let files: Record<string, string> = {};
  let styles: Record<string, string[]> = {};
  const dirs = fs.readdirSync(pathString);
  dirs.forEach((dir) => {
    if ([".DS_Store"].includes(dir)) return true;
    const isDir = fs.lstatSync(`${pathString}/${dir}`).isDirectory();
    if (isDir) {
      const data = readDir(`${pathString}/${dir}`);
      styles = { ...styles, ...data.styles };
      files = { ...files, ...data.files };
    } else {
      const data = readFile(`${pathString}/${dir}`);
      styles = { ...styles, ...data.styles };
      files = { ...files, ...data.files };
    }
    return true;
  });
  return { styles, files };
};
const readFile = (file: string) => {
  const files: Record<string, string> = {};
  const styles: Record<string, string[]> = {};
  const data = fs.readFileSync(file, { encoding: "utf8", flag: "r" });
  if (data.includes("StyleSheet.create({")) {
    styles[file] = extractStyleObject(data);
    files[file] =
      data.split("StyleSheet.create({")?.[0] +
      data.split("StyleSheet.create({")?.[1]?.split("});")?.[1];
  } else {
    files[file] = data;
  }
  return { styles, files };
};

const extractStyleObject = (data: string): string[] => {
  const temp = data.split("StyleSheet.create({")?.[1]?.split("});")?.[0];
  const keys = temp.split(": {").map((text) => {
    const k = text.split(" ");
    const t = text.split(",");
    if (t.length) {
      const l = t[t.length - 2];
      if (l && !l?.includes?.("}")) return undefined;
    }
    return k[k.length - 1];
  });
  return keys.filter((s) => !!s).slice(0, -2) as string[];
};

const checkIfStyleImported = (
  stylePath: string,
  styleName: string,
  filePath: string,
  data: string
) => {
  const ext = `.${styleName.split(".")[1]}`;
  const imports = data
    .split("\n")
    .map((line) => {
      if (line.startsWith("import")) {
        const p = line.split("from ")?.[1]?.slice(1, -2) || "";
        return {
          path: p.endsWith(ext) ? p : p + ext,
          name: line
            .split(line.includes("{") ? "{" : "import")?.[1]
            ?.split(line.includes("{") ? "}" : "from")?.[0]
            ?.trim()
            ?.split(", "),
        };
      }
      return undefined;
    })
    .filter((imp) => !!imp)
    .map((p) => ({
      path: path.join(
        base,
        p?.path?.startsWith?.("app")
          ? ""
          : filePath.split("/").slice(0, -1).join("/"),
        p?.path || ""
      ),
      name: p?.name,
    }))
    .filter((item) => {
      if (item.path === stylePath) {
        return true;
      }
      return false;
    });
  return imports?.[0]?.name;
};

const getUsedStyles = (importName: string, keys: string[], text: string) => {
  return keys.filter((key) => {
    return text.includes(`${importName}.${key}`);
  });
};

const getDirsUnusedStyles = (dir: string, files: Record<string, string>) => {
  const { styles } = readDir(dir);
  const unusedStyles: Record<string, string[]> = {};
  Object.keys(styles).forEach((style) => {
    console.log(`Checking unused styles for ${style}`);

    const styleName = style.split("/")?.[style.split("/").length - 1];
    let usedStyles: string[] = [];
    Object.keys(files).forEach((file) => {
      const imports = checkIfStyleImported(
        path.join(base, style),
        styleName,
        file,
        files[file]
      );
      if (imports) {
        imports?.forEach((importName) => {
          usedStyles = [
            ...usedStyles,
            ...getUsedStyles(importName, styles[style], files[file]),
          ];
        });
      }
    });
    const unused = styles[style].filter((key) => !usedStyles.includes(key));
    if (unused.length) unusedStyles[style] = unused;
  });

  return unusedStyles;
};

const remove = (data: Record<string, string[] | undefined>[]) => {
  data.forEach((item) => {
    Object.keys(item).forEach((file: string) => {
      console.log("Removing from " + file);

      let text = fs.readFileSync(file, { encoding: "utf8", flag: "r" });
      (item[file] as string[]).forEach((key) => {
        let scopeCount = 0;
        let finalText = "";
        text.split("\n").forEach((line) => {
          if (line.includes(`${key}: {`) && !scopeCount) {
            finalText += `${line.split(`${key}: {`)[0]}\n`;

            if (!line.split(`${key}: {`)[1]?.includes?.("},")) {
              scopeCount = 1;
            }
          } else if (scopeCount > 0) {
            if (line.includes("{")) {
              scopeCount++;
            }
            if (line.includes("}")) {
              scopeCount--;
            }
          } else {
            finalText += `${line}\n`;
          }
        });
        text = finalText;
      });
      fs.writeFileSync(file, text);
    });
  });
};

if (process.argv.includes("--remove-json")) {
  const json = process.argv?.[3];
  const data = require(path.join(base, json));
  remove(data);
} else {
  const folders = process.argv.slice(2).filter((d) => d !== "--remove");
  const init = () => {
    let totalUnusedCount = 0;
    const data: any = [];
    folders.forEach((folder) => {
      const { files } = readDir(base);
      const unUsed = getDirsUnusedStyles(folder, files);
      const count = sum(Object.keys(unUsed).map((u) => unUsed[u].length));
      console.log(folder, count);
      totalUnusedCount += count;
      data.push(unUsed);
    });
    if (process.argv.includes("--remove")) {
      remove(data);
    } else if (data.length)
      fs.writeFileSync("unused-styles.json", JSON.stringify(data, null, 2));
    console.log(">Total Unused styles: ", totalUnusedCount);
  };

  init();
}
