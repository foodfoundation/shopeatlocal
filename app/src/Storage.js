import { access, createWriteStream, constants } from "fs";
import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { diskStorage } from "multer";

import {
  LenNameFileStoreImg,
  S3Region,
  S3DocumentBucketAccessKeyId,
  S3DocumentBucketSecretAccessKey,
  S3PublicBucketAccessKeyId,
  S3PublicBucketSecretAccessKey,
  S3DocumentBucket,
  S3PublicBucket,
  S3ImageStoragePrefix,
  S3Acl,
  ImageStoragePrefix,
  StorageType,
} from "../Cfg.js";
import { NameRndAlphaNum, PathNameFileStoreDoc } from "./Util.js";
import { extname } from "path";

import { promisify } from "node:util";
const accessAsync = promisify(access);

const generateRandomFileName = aFile =>
  `${NameRndAlphaNum(LenNameFileStoreImg)}${extname(aFile.originalname)}`;

const S3Storage = () => {
  const s3ClientPrivate = new S3Client({
    region: S3Region,
    credentials: {
      accessKeyId: S3DocumentBucketAccessKeyId,
      secretAccessKey: S3DocumentBucketSecretAccessKey,
    },
  });

  const s3ClientPublic = new S3Client({
    region: S3Region,
    credentials: {
      accessKeyId: S3PublicBucketAccessKeyId,
      secretAccessKey: S3PublicBucketSecretAccessKey,
    },
  });

  const fileUpload = async ({ nameFile, passThrough, contentType = "application/pdf" }) => {
    const upload = new Upload({
      client: s3ClientPrivate,
      params: {
        Bucket: S3DocumentBucket,
        Key: nameFile,
        Body: passThrough,
        ContentType: contentType,
      },
    });

    try {
      await upload.done();
    } catch (err) {
      console.error("failed_to_upload_file_s3", `name: ${nameFile}`, err);
    }
  };

  const sendFile = async (aResp, { fileName, documentName }) => {
    const params = {
      Bucket: S3DocumentBucket,
      Key: fileName,
    };

    // Get the file stream from S3
    const getCommand = new GetObjectCommand(params);
    try {
      const response = await s3ClientPrivate.send(getCommand);
      const s3Stream = response.Body;
      aResp.setHeader("Content-Disposition", `inline; filename="${documentName}"`);
      aResp.setHeader("Content-Type", "application/pdf");

      s3Stream.pipe(aResp);
    } catch (err) {
      if ((err.name = "NoSuchKey")) {
        aResp.status(404);
        aResp.render("Misc/404");
      } else {
        console.error("failed_to_get_object_s3", `name: ${fileName}`, err);
        aResp.status(500);
        aResp.render("Misc/500");
      }
    }
  };

  const multerStorage = {
    _handleFile: (_aReq, aFile, aCallback) => {
      const oName = generateRandomFileName(aFile);

      const upload = new Upload({
        client: s3ClientPublic,
        params: {
          Bucket: S3PublicBucket,
          Key: `${S3ImageStoragePrefix ? `${S3ImageStoragePrefix}/` : ""}${oName}`,
          Body: aFile.stream,
          ContentType: aFile.mimetype,
          ACL: S3Acl ?? "public-read", // Set public-read permission for the uploaded file - make sure ACLs are enabled on the bucket
        },
      });

      upload
        .done()
        .then(_ =>
          aCallback(null, {
            filename: oName,
          }),
        )
        .catch(err => {
          console.error("failed_to_upload_image_s3", `name: ${oName}`, err);
          aCallback(err);
        });
    },

    _removeFile: (_req, aFile, aCallback) => {
      // [TODO]: it looks that this function is not being called when removing a file
      // from the form.
      // The DB is updated, but the file is not removed from S3.
      const params = {
        Bucket: S3PublicBucket,
        Key: `${S3ImageStoragePrefix ? `${S3ImageStoragePrefix}/` : ""}${aFile.key}`,
      };
      const deleteCommand = DeleteObjectCommand(params);
      s3ClientPublic
        .send(deleteCommand)
        .then(data => aCallback(null, data))
        .catch(err => {
          console.error("failed_to_remove_image_s3", `name: ${aFile.key}`, err);
          aCallback(err);
        });
    },
  };

  return {
    multerStorage,
    files: {
      upload: fileUpload,
      sendFile,
    },
  };
};

const DiskStorage = () => {
  const multerStorage = diskStorage({
    destination: `${ImageStoragePrefix.substring(1)}/`,

    filename: function (_aReq, aFile, aDone) {
      const oName = generateRandomFileName(aFile);
      aDone(null, oName);
    },
  });

  const fileUpload = async ({ nameFile, passThrough }) => {
    const oPathNameFile = PathNameFileStoreDoc(nameFile);
    const oStmFile = createWriteStream(oPathNameFile);

    passThrough.pipe(oStmFile);

    await new Promise((resolve, reject) => {
      oStmFile.on("finish", resolve);
      oStmFile.on("error", reject);
    });
  };

  const sendFile = async (aResp, { fileName, documentName }) => {
    const oPathName = PathNameFileStoreDoc(fileName);
    try {
      // If I understand correctly, there is no way in Node to check for a file's
      // existence without producing an exception (or invoking an error callback,
      // more idiomatically):
      await accessAsync(oPathName, constants.R_OK);
    } catch (oErr) {
      aResp.status(404);
      aResp.render("Misc/404");
      return;
    }
    // This sets the suggested filename if the user chooses to download file,
    // without causing the download to start on its own:
    aResp.set("Content-Disposition", `inline; filename="${documentName}"`);

    aResp.sendFile(oPathName);
  };

  return {
    multerStorage,
    files: {
      upload: fileUpload,
      sendFile,
    },
  };
};

export const Storage = (function () {
  if (StorageType === "disk") {
    return DiskStorage();
  } else if (StorageType === "S3") {
    return S3Storage();
  }
  throw new Error("invalid_storage_type");
})();
