import crypto from "crypto";
import mongoose from "mongoose";
import FSNode from "../models/FSNode";
import FileContent from "../models/FileContent";
import Session from "../models/Session";
import Workspace from "../models/Workspace";
import User from "../models/User";



function computeHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function saveFileContent(nodeId: string, content: string): Promise<void> {
  try {
    const newHash = computeHash(content);
    const existing = await FileContent.findOne({ nodeId }).select("hash").lean();
    
    if (existing && existing.hash === newHash) return;

    await FileContent.findOneAndUpdate(
      { nodeId },
      { nodeId, content, hash: newHash },
      { upsert: true, new: true }
    );
  } catch (err: any) {
    console.error(`[DB] saveFileContent failed [${nodeId}]:`, err.message);
  }
}

export async function loadFileHash(contentId : string) : Promise<string> {
  try {
    const doc = await FileContent.findOne({ _id: contentId }).select("hash").lean();
    return doc?.hash ?? "";
  } catch (err: any) {
    console.error(`[DB] loadFileContent failed [${contentId}]:`, err.message);
    return "";
  }  
}

export async function loadFileContent(contentId: string): Promise<string> {
  try {
    const doc = await FileContent.findOne({ _id: contentId }).select("content").lean();
    return doc?.content ?? "";
  } catch (err: any) {
    console.error(`[DB] loadFileContent failed [${contentId}]:`, err.message);
    return "";
  }
} 

export async function getNodeByPath(workspaceId: string, path: string) {
  try {
    return await FSNode.findOne({ workspaceId, path }).lean();
  } catch (err: any) {
    console.error(`[DB] getNodeByPath failed [${workspaceId}:${path}]:`, err.message);
    return null;
  }
}

export async function getNodeById(nodeId: string) {
  try {
    return await FSNode.findById(nodeId).lean();
  } catch (err: any) {
    console.error(`[DB] getNodeById failed [${nodeId}]:`, err.message);
    return null;
  }
}

export async function createFileNode(workspaceId: string, parentId: string, name: string, path: string) {
  try {
    const existing = await getNodeByPath(workspaceId, path);
    if (existing) return existing;

    const actualParentId = (parentId === workspaceId) ? null : parentId;

    const node = await FSNode.create({
      workspaceId,
      parentId: actualParentId,
      name,
      type: "file",
      path
    });

    const content = await FileContent.create({
      nodeId: node._id,
      content: "",
      hash: computeHash("")
    });

    node.contentId = content._id as mongoose.Types.ObjectId;
    await node.save();

    return node;
  } catch (err: any) {
    // Concurrent FILE_OPEN + FILE_CREATE can both pass the initial getNodeByPath; loser hits E11000.
    const dup =
      err?.code === 11000 || String(err?.message ?? "").includes("E11000");
    if (dup) {
      const retry = await getNodeByPath(workspaceId, path);
      if (retry && retry.type === "file") return retry;
    }
    console.error(`[DB] createFileNode failed [${path}]:`, err.message);
    return null;
  }
}

export async function deleteFileNode(nodeId: string): Promise<boolean> {
  try {
    await FileContent.deleteOne({ nodeId });
    await FSNode.findByIdAndDelete(nodeId);
    return true;
  } catch (err: any) {
    console.error(`[DB] deleteFileNode failed [${nodeId}]:`, err.message);
    return false;
  }
}

export async function renameFileNode(nodeId: string, newName: string, newPath: string): Promise<boolean> {
  try {
    await FSNode.findByIdAndUpdate(nodeId, {
      name: newName,
      path: newPath,
    });
    return true;
  } catch (err: any) {
    console.error(`[DB] renameFileNode failed [${nodeId}]:`, err.message);
    return false;
  }
}

export async function moveFileNode(nodeId: string, newParentId: string, newPath: string): Promise<boolean> {
  try {
    const actualParentId = (newParentId === nodeId) ? null : newParentId;

    await FSNode.findByIdAndUpdate(nodeId, {
      parentId: actualParentId,
      path: newPath,
    });
    return true;
  } catch (err: any) {
    console.error(`[DB] moveFileNode failed [${nodeId}]:`, err.message);
    return false;
  }
}

export async function createDirNode(workspaceId: string, parentId: string, name: string, path: string) {
  try {
    const existing = await FSNode.findOne({ workspaceId, path }).lean();
    if (existing) return existing;

    const actualParentId = (parentId === workspaceId) ? null : parentId;

    return await FSNode.create({
      workspaceId,
      parentId: actualParentId,
      name,
      type: "folder",
      path,
    });
  } catch (err: any) {
    console.error(`[DB] createDirNode failed [${path}]:`, err.message);
    return null;
  }
}

export async function ensureDirExist(workspaceId: string, dirPath: string) : Promise<string | null> {
  if(!dirPath) return workspaceId;
  const existing = await FSNode.findOne({workspaceId, path: dirPath, type : "folder"}).lean();
  if(existing) return existing._id.toString();
  const lstSlash = dirPath.lastIndexOf("/");
  const parentPath = lstSlash > 0 ? dirPath.slice(0, lstSlash) : "";
  const name = dirPath.slice(lstSlash + 1);
  const parentId = await ensureDirExist(workspaceId, parentPath);
  if(!parentId) return null;
  try {
    const actualParentId = (parentId === workspaceId) ? null : parentId;
    const newNode = await FSNode.create({
      workspaceId,
      parentId: actualParentId,
      name,
      type: "folder",
      path: dirPath,
    });
    return newNode._id.toString();
  } catch (err:  any) {
    console.error(`[DB] ensureDirRecursive failed to create [${dirPath}]:`, err.message);
    return null;
  }
}

/** Ensures a file node exists (handles FILE_OPEN racing ahead of FILE_CREATE). */
export async function getOrCreateFileNodeByPath(workspaceId: string, filePath: string) {
  const existing = await getNodeByPath(workspaceId, filePath);
  if (existing) {
    return existing.type === "file" ? existing : null;
  }
  const lstSlash = filePath.lastIndexOf("/");
  const name = filePath.slice(lstSlash + 1);
  const parentPath = lstSlash > 0 ? filePath.slice(0, lstSlash) : "";
  const parentId = await ensureDirExist(workspaceId, parentPath);
  if (!parentId) return null;
  const created = await createFileNode(workspaceId, parentId, name, filePath);
  if (created) return created;
  const retry = await getNodeByPath(workspaceId, filePath);
  return retry && retry.type === "file" ? retry : null;
}

export async function deleteDirRecursive(workspaceId: string, dirNodeId: string): Promise<string[]> {
  try {
    const result = await FSNode.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(dirNodeId) } },
      {
        $graphLookup: {
          from: "fsnodes",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "parentId",
          as: "descendants",
        }
      }
    ]);

    if (!result || result.length === 0) return [];

    const root = result[0];
    const allNodes = [root, ...root.descendants];
    const allNodeIds = allNodes.map(n => n._id);
    const allPaths = allNodes.map(n => n.path);
    
    const fileNodeIds = allNodes
      .filter(n => n.type === "file")
      .map(n => n._id);

    if (fileNodeIds.length > 0) {
      await FileContent.deleteMany({ nodeId: { $in: fileNodeIds } });
    }
    
    await FSNode.deleteMany({ _id: { $in: allNodeIds } });
    return allPaths;
  } catch (err: any) {
    console.error(`[DB] deleteDirRecursive failed [${dirNodeId}]:`, err.message);
    return [];
  }
}

export async function renameDirNode(
  workspaceId: string,
  nodeId: string,
  newName: string,
  oldPath: string,
  newPath: string
): Promise<boolean> {
  try {
    await FSNode.findByIdAndUpdate(nodeId, { name: newName, path: newPath });

    const children = await FSNode.find({
      workspaceId,
      path: { $regex: `^${oldPath}/` }
    }).lean();

    const bulkOps = children.map((child: any) => ({
      updateOne: {
        filter: { _id: child._id },
        update: {
          $set: { path: child.path.replace(oldPath, newPath) }
        }
      }
    }));

    if (bulkOps.length > 0) await FSNode.bulkWrite(bulkOps);
    return true;
  } catch (err: any) {
    console.error(`[DB] renameDirNode failed [${nodeId}]:`, err.message);
    return false;
  }
}

export async function moveDirNode(
  workspaceId: string,
  nodeId: string,
  newParentId: string,
  oldPath: string,
  newPath: string
): Promise<boolean> {
  try {
    const actualParentId = (newParentId === workspaceId) ? null : newParentId;

    await FSNode.findByIdAndUpdate(nodeId, {
      parentId: actualParentId,
      path: newPath,
    });

    const children = await FSNode.find({
      workspaceId,
      path: { $regex: `^${oldPath}/` }
    }).lean();

    const bulkOps = children.map((child: any) => ({
      updateOne: {
        filter: { _id: child._id },
        update: {
          $set: { path: child.path.replace(oldPath, newPath) }
        }
      }
    }));

    if (bulkOps.length > 0) await FSNode.bulkWrite(bulkOps);
    return true;
  } catch (err: any) {
    console.error(`[DB] moveDirNode failed [${nodeId}]:`, err.message);
    return false;
  }
}

export async function findOrCreateUser(machineId: string, username: string) {
  try {
    return await User.findOneAndUpdate(
      { machineId },
      { machineId, username },
      { upsert: true, new: true }
    );
  } catch (err: any) {
    console.error(`[DB] findOrCreateUser failed [${machineId}]:`, err.message);
    return null;
  }
}

export async function addActiveUser(workspaceId: string, userId: string): Promise<void> {
  try {
    await Session.findOneAndUpdate(
      { workspaceId },
      { $addToSet: { activeUsers: new mongoose.Types.ObjectId(userId) } },
      { upsert: true }
    );
  } catch (err: any) {
    console.error(`[DB] addActiveUser failed [${workspaceId}:${userId}]:`, err.message);
  }
}

export async function removeActiveUser(workspaceId: string, userId: string): Promise<void> {
  try {
    await Session.findOneAndUpdate(
      { workspaceId },
      { $pull: { activeUsers: new mongoose.Types.ObjectId(userId) } }
    );
  } catch (err: any) {
    console.error(`[DB] removeActiveUser failed [${workspaceId}:${userId}]:`, err.message);
  }
}

export async function getWorkspaceBySessionKey(sessionKey: string) {
  try {
    return await Workspace.findOne({ sessionKey }).lean();
  } catch (err: any) {
    console.error(`[DB] getWorkspaceBySessionKey failed [${sessionKey}]:`, err.message);
    return null;
  }
}

export async function getFileContent(nodeId: string): Promise<string> {
  const doc = await FileContent.findOne({ nodeId }).select("content").lean();
  return doc ? doc.content : "";
}

export async function getFileTree(workspaceId: string) {
  try {
    const nodes = await FSNode.find({ workspaceId })
      .select("type path contentId")
      .lean();

    return await Promise.all(
      nodes.map(async (node) => {
        let fileContent = null;
        if(node.type === "file" && node.contentId) {
          fileContent = await loadFileContent(node.contentId.toString());
        }
        return {
          type: node.type,
          path: node.path,
          content: fileContent
        };
      })
    );
  } catch (err: any) {
    console.error(`[DB] getFileTree failed [${workspaceId}]:`, err.message);
    return [];
  }
}
// import crypto from "crypto";
// import FSNode from "../models/FSNode"
// import FileContent from "../models/FileContent"
// import Session from "../models/Session"
// import Workspace from "../models/Workspace"
// import User from "../models/User"
// import path = require("path");
// import mongoose from "mongoose";

// function computeHash(content: string) : string {
//   return crypto.createHash("sha256").update(content).digest("hex");
// }

// export async function saveFileContent(nodeId: string, content: string): Promise<void> {
//   try {
//     const newHash = computeHash(content);
//     const existing = await FileContent.findOne({nodeId}).select("hash").lean();
//     if(existing && existing.hash === newHash) return;

//     await FileContent.findOneAndUpdate(
//       {nodeId},
//       {nodeId, content, hash: newHash},
//       {upsert: true, new: true}
//     );
//   } catch (err: any) {
//     console.error(
//       `[DB] saveFileContent failed [${nodeId}]:`,
//       err.message
//     );
//   }
// }

// export async function loadFileContent(nodeId: string) : Promise<string> {
//   try {
//     const doc = await FileContent.findOne({nodeId}).select("content").lean();
//     return doc?.content ?? "";
//   } catch (err: any) {
//     console.error(
//       `[DB] loadFileContent failed [${nodeId}]:`,
//       err.message
//     );
//   }
//   return "";
// }

// export async function getNodeByPath(workspaceId: string, path: string) {
//   try {
//     return await FSNode.findOne({workspaceId, path}).lean();
//   } catch (err: any) {
//     console.error(
//       `[DB] getNodeByPath failed [${workspaceId}:${path}]:`,
//       err.message
//     );  
//   }
//   return null;
// }

// export async function getNodeById(nodeId: string) {
//   try {
//     return await FSNode.findById(nodeId).lean();
//   } catch (err: any) {
//     console.error(
//       `[DB] getNodeById failed [${nodeId}]:`,
//       err.message
//     );  
//   }
//   return null;
// }

// export async function createFileNode(workspaceId: string, parentId: string, name: string, path: string) {
//   try {
//     const existing = await getNodeByPath(workspaceId, path);
//     if(existing) return existing;

//     const actualParentId = (parentId === workspaceId) ? null : parentId;

//     const node = await FSNode.create({
//       workspaceId,
//       parentId: actualParentId,
//       name,
//       type: "file",
//       path
//     });

//     const content = await FileContent.create({
//       nodeId: node._id,
//       content: "",
//       hash: computeHash("")
//     });

//     node.contentId = content._id as mongoose.Types.ObjectId;
//     await node.save();

//     return node;
//   } catch (err: any) {
//     console.error(
//       `[DB] createFileNode failed [${path}]:`,
//       err.message
//     );
//   }
//   return null;
// }

// export async function deleteFileNode(nodeId: string): Promise<boolean> {
//   try {
//     await FileContent.deleteOne({ nodeId });
//     await FSNode.findByIdAndDelete(nodeId);
//     return true;
//   } catch (err: any) {
//     console.error(
//       `[DB] deleteFileNode failed [${nodeId}]:`,
//       err.message
//     );
//     return false;
//   }
// }

// export async function renameFileNode(
//   nodeId:  string,
//   newName: string,
//   newPath: string
// ): Promise<boolean> {
//   try {
//     await FSNode.findByIdAndUpdate(nodeId, {
//       name: newName,
//       path: newPath,
//     });
//     return true;
//   } catch (err: any) {
//     console.error(
//       `[DB] renameFileNode failed [${nodeId}]:`,
//       err.message
//     );
//     return false;
//   }
// }

// export async function moveFileNode(
//   nodeId:      string,
//   newParentId: string,
//   newPath:     string
// ): Promise<boolean> {
//   try {
//     await FSNode.findByIdAndUpdate(nodeId, {
//       parentId: newParentId,
//       path:     newPath,
//     });
//     return true;
//   } catch (err: any) {
//     console.error(
//       `[DB] moveFileNode failed [${nodeId}]:`,
//       err.message
//     );
//     return false;
//   }
// }

// export async function createDirNode(
//   workspaceId: string,
//   parentId:    string,
//   name:        string,
//   path:        string
// ) {
//   try {
//     const existing = await FSNode.findOne({ workspaceId, path }) .lean();
//     if (existing) return null; 
//     const node = await FSNode.create({
//       workspaceId,
//       parentId,
//       name,
//       type: "folder",
//       path,
//     });

//     return node;
//   } catch (err: any) {
//     console.error(
//       `[DB] createDirNode failed [${path}]:`,
//       err.message
//     );
//     return null;
//   }
// }

// export async function deleteDirRecursive(workspaceId: string, dirNodeId: string) : Promise<string[]> {
//   try {
//     const result = await FSNode.aggregate([
//       {
//         $match: {_id: dirNodeId}
//       },
//       {
//         $graphLookup: {
//           from: "fsnodes",
//           startWith: "$_id",
//           connectFromField: "_id",
//           connectToField: "parentId",
//           as: "descendants",
//           depthField: "depth"
//         }
//       },
//       {
//         $project: {
//           _id: 1,
//           path: 1,
//           type: 1,
//           descendants: {
//             _id: 1,
//             path: 1,
//             type: 1          
//           }
//         }
//       }
//     ]);
//     if(!result || result.length === 0) return [];
//     const root = result[0];
//     const allNodes = [root, ...root.descendants];
//     const allNodeIds = allNodes.map((node) => node._id);
//     const allPaths = allNodes.map((node) => node.path);
//     const fileNodeIds = allNodes.filter((node) => node.type === "file").map((node) => node._id);
//     if(fileNodeIds.length > 0) {
//       await FileContent.deleteMany({nodeId: {$in: fileNodeIds}});    
//     }
//     await FSNode.deleteMany({_id: {$in: allNodeIds}});
//     return allPaths;
//   } catch (err: any) {
//     console.error(
//       `[DB] deleteDirRecursive failed [${dirNodeId}]:`,
//       err.message
//     );
//     return [];
//   }
// }

// export async function renameDirNode(
//   workspaceId: string,
//   nodeId:      string,
//   newName:     string,
//   oldPath:     string,
//   newPath:     string
// ): Promise<boolean> {
//   try {
//     await FSNode.findByIdAndUpdate(nodeId, {
//       name: newName,
//       path: newPath,
//     });

//     const children = await FSNode.find({
//       workspaceId,
//       path: { $regex: `^${oldPath}/` }
//     }).lean();

//     const bulkOps = children.map((child: any) => ({
//       updateOne: {
//         filter: { _id: child._id },
//         update: {
//           $set: {
//             path: child.path.replace(oldPath, newPath)
//           }
//         }
//       }
//     }));

//     if (bulkOps.length > 0) {
//       await FSNode.bulkWrite(bulkOps);
//     }

//     return true;
//   } catch (err: any) {
//     console.error(
//       `[DB] renameDirNode failed [${nodeId}]:`,
//       err.message
//     );
//     return false;
//   }
// }

// export async function moveDirNode(
//   workspaceId: string,
//   nodeId:      string,
//   newParentId: string,
//   oldPath:     string,
//   newPath:     string
// ): Promise<boolean> {
//   try {
//     await FSNode.findByIdAndUpdate(nodeId, {
//       parentId: newParentId,
//       path:     newPath,
//     });

//     const children = await FSNode.find({
//       workspaceId,
//       path: { $regex: `^${oldPath}/` }
//     }).lean();

//     const bulkOps = children.map((child: any) => ({
//       updateOne: {
//         filter: { _id: child._id },
//         update: {
//           $set: {
//             path: child.path.replace(oldPath, newPath)
//           }
//         }
//       }
//     }));

//     if (bulkOps.length > 0) {
//       await FSNode.bulkWrite(bulkOps);
//     }

//     return true;
//   } catch (err: any) {
//     console.error(
//       `[DB] moveDirNode failed [${nodeId}]:`,
//       err.message
//     );
//     return false;
//   }
// }

// export async function findOrCreateUser(
//   machineId: string,
//   username:  string
// ) {
//   try {
//     return await User.findOneAndUpdate(
//       { machineId },
//       { machineId, username },
//       { upsert: true, new: true }
//     );
//   } catch (err: any) {
//     console.error(
//       `[DB] findOrCreateUser failed [${machineId}]:`,
//       err.message
//     );
//     return null;
//   }
// }

// export async function addActiveUser(
//   workspaceId: string,
//   userId:      string
// ): Promise<void> {
//   try {
//     await Session.findOneAndUpdate(
//       { workspaceId },
//       { $addToSet: { activeUsers: userId } },
//       { upsert: true }
//     );
//   } catch (err: any) {
//     console.error(
//       `[DB] addActiveUser failed [${workspaceId}:${userId}]:`,
//       err.message
//     );
//   }
// }

// export async function removeActiveUser(
//   workspaceId: string,
//   userId:      string
// ): Promise<void> {
//   try {
//     await Session.findOneAndUpdate(
//       { workspaceId },
//       { $pull: { activeUsers: userId } }
//     );
//   } catch (err: any) {
//     console.error(
//       `[DB] removeActiveUser failed [${workspaceId}:${userId}]:`,
//       err.message
//     );
//   }
// }

// export async function getWorkspaceBySessionKey(
//   sessionKey: string
// ) {
//   try {
//     return await Workspace
//       .findOne({ sessionKey })
//       .lean();
//   } catch (err: any) {
//     console.error(
//       `[DB] getWorkspaceBySessionKey failed [${sessionKey}]:`,
//       err.message
//     );
//     return null;
//   }
// }

// export async function getFileTree(workspaceId: string) {
//   try {
//     return await FSNode
//       .find({ workspaceId })
//       .select("_id parentId name type path")
//       .lean();
//   } catch (err: any) {
//     console.error(
//       `[DB] getFileTree failed [${workspaceId}]:`,
//       err.message
//     );
//     return [];
//   }
// }