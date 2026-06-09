import { auth, hasFirebaseConfig } from './firebase.js'

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = dataUrl
  })
}

function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.78) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('图片压缩失败。'))
    }, type, quality)
  })
}

async function makeImageUploadBlob(file, { maxSize = 900, quality = 0.78 } = {}) {
  if (!file?.type?.startsWith('image/')) throw new Error('请选择图片文件。')
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file

  const dataUrl = await readFileAsDataUrl(file)
  const image = await loadImageFromDataUrl(dataUrl)
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0, width, height)
  return canvasToBlob(canvas, 'image/jpeg', quality)
}

function getUploadContentType(blob, file) {
  return blob?.type || file?.type || 'application/octet-stream'
}

async function uploadImageBlobToCos(blob, file) {
  if (!hasFirebaseConfig || !auth?.currentUser) throw new Error('请先登录账号，登录后图片会上传到云端并跨端同步。')

  const idToken = await auth.currentUser.getIdToken()
  const contentType = getUploadContentType(blob, file)
  const signResponse = await fetch('/api/cos-upload-sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Firebase-Token': idToken,
    },
    body: JSON.stringify({
      filename: file?.name || 'image',
      contentType,
      size: blob.size,
      uid: auth.currentUser.uid,
    }),
  })

  const signPayload = await signResponse.json().catch(() => null)
  if (!signResponse.ok) throw new Error(signPayload?.message || '图片上传签名失败。')

  const uploadResponse = await fetch(signPayload.uploadUrl, {
    method: 'PUT',
    headers: {
      ...(signPayload.headers || {}),
      'Content-Type': signPayload.contentType || contentType,
    },
    body: blob,
  })

  if (!uploadResponse.ok) throw new Error(`图片上传失败：${uploadResponse.status}`)
  return signPayload.publicUrl
}

async function compressImageFile(file, { maxSize = 900, quality = 0.78, uploadToCos = true, fallbackToDataUrl = true } = {}) {
  if (!file?.type?.startsWith('image/')) throw new Error('请选择图片文件。')
  const blob = await makeImageUploadBlob(file, { maxSize, quality })

  if (uploadToCos && hasFirebaseConfig && auth?.currentUser) {
    try {
      return await uploadImageBlobToCos(blob, file)
    } catch (error) {
      if (!fallbackToDataUrl) throw error
      console.warn('[miki] COS image upload failed, falling back to local data URL:', error)
    }
  }

  return readBlobAsDataUrl(blob)
}

export { readFileAsDataUrl, loadImageFromDataUrl, compressImageFile, uploadImageBlobToCos }
