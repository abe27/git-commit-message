// src/extension.ts - โค้ดหลักของ extension
import * as vscode from "vscode";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  // ลงทะเบียน command
  let disposable = vscode.commands.registerCommand(
    "git-commit-generator.generateCommitMessage",
    async () => {
      try {
        // ตรวจสอบว่ามี git repo ไหม
        const gitExtension =
          vscode.extensions.getExtension("vscode.git")?.exports;
        if (!gitExtension) {
          vscode.window.showErrorMessage("Git extension is not available");
          return;
        }

        const git = gitExtension.getAPI(1);
        if (!git) {
          vscode.window.showErrorMessage("Git API is not available");
          return;
        }

        // ดึง repo ปัจจุบัน
        const repository = git.repositories[0];
        if (!repository) {
          vscode.window.showErrorMessage("No git repository found");
          return;
        }

        // ดึงข้อมูล changes
        const changes = await getChangedFiles(repository);
        if (changes.length === 0) {
          vscode.window.showWarningMessage("No changes detected");
          return;
        }

        // สร้าง commit message จาก changes
        const commitMessage = generateCommitMessage(changes);

        // ใส่ commit message ใน input box
        repository.inputBox.value = commitMessage;

        vscode.window.showInformationMessage("Commit message generated!");
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  context.subscriptions.push(disposable);
}

// ฟังก์ชันเพื่อดึงข้อมูลไฟล์ที่เปลี่ยนแปลง
async function getChangedFiles(
  repository: any
): Promise<{ path: string; status: string }[]> {
  const changes: { path: string; status: string }[] = [];

  // ดึงข้อมูลจาก repository state
  const state = repository.state;

  // ดึงไฟล์ที่เพิ่มเข้ามาใหม่ ไฟล์ที่แก้ไข และไฟล์ที่ลบ
  for (const change of state.workingTreeChanges) {
    let status = "";

    switch (change.status) {
      case 1: // INDEX_MODIFIED
        status = "modified";
        break;
      case 2: // INDEX_ADDED
        status = "added";
        break;
      case 3: // INDEX_DELETED
        status = "deleted";
        break;
      case 4: // INDEX_RENAMED
        status = "renamed";
        break;
      case 5: // INDEX_COPIED
        status = "copied";
        break;
      default:
        status = "changed";
        break;
    }

    changes.push({
      path: change.uri.fsPath,
      status: status,
    });
  }

  return changes;
}

// ฟังก์ชันสร้าง commit message
function generateCommitMessage(
  changes: { path: string; status: string }[]
): string {
  // กลุ่มการเปลี่ยนแปลงตามประเภท
  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];
  const other: string[] = [];

  // แยกประเภทการเปลี่ยนแปลง
  for (const change of changes) {
    const filename = path.basename(change.path);

    switch (change.status) {
      case "added":
        added.push(filename);
        break;
      case "modified":
        modified.push(filename);
        break;
      case "deleted":
        deleted.push(filename);
        break;
      default:
        other.push(filename);
        break;
    }
  }

  // สร้าง message
  let message = "";

  // สร้างหัวข้อหลัก
  if (changes.length === 1) {
    const change = changes[0];
    const filename = path.basename(change.path);
    message = `${
      change.status.charAt(0).toUpperCase() + change.status.slice(1)
    } ${filename}`;
  } else {
    // หา directory ที่มีการเปลี่ยนแปลงมากที่สุด
    const directories = changes.map(
      (change) => path.dirname(change.path).split(path.sep).pop() || ""
    );
    const dirCount: { [key: string]: number } = {};

    for (const dir of directories) {
      dirCount[dir] = (dirCount[dir] || 0) + 1;
    }

    let maxDir = "";
    let maxCount = 0;

    for (const dir in dirCount) {
      if (dirCount[dir] > maxCount) {
        maxDir = dir;
        maxCount = dirCount[dir];
      }
    }

    if (maxCount > changes.length / 2) {
      message = `Update in ${maxDir}: `;
    } else {
      message = `Multiple changes: `;
    }
  }

  // สร้างรายละเอียด
  const details: string[] = [];

  if (added.length > 0) {
    if (added.length === 1) {
      details.push(`Add ${added[0]}`);
    } else {
      details.push(`Add ${added.length} files`);
    }
  }

  if (modified.length > 0) {
    if (modified.length === 1) {
      details.push(`Modify ${modified[0]}`);
    } else {
      details.push(`Modify ${modified.length} files`);
    }
  }

  if (deleted.length > 0) {
    if (deleted.length === 1) {
      details.push(`Delete ${deleted[0]}`);
    } else {
      details.push(`Delete ${deleted.length} files`);
    }
  }

  if (other.length > 0) {
    if (other.length === 1) {
      details.push(`Change ${other[0]}`);
    } else {
      details.push(`Change ${other.length} files`);
    }
  }

  // รวม message กับ details
  if (details.length > 0) {
    message += details.join(", ");
  }

  return message;
}

export function deactivate() {}
