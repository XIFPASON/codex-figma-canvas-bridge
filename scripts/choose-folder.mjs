import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

export async function chooseFolder() {
  if(process.platform!=='win32')throw Error('文件夹选择窗口目前支持 Windows；其他系统请使用 --dir 指定目录');
  const script=fileURLToPath(new URL('./choose-folder.ps1',import.meta.url));
  const {stdout}=await promisify(execFile)('powershell.exe',['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',script],{windowsHide:true,maxBuffer:1024*1024});
  const encoded=stdout.trim();
  return encoded?Buffer.from(encoded,'base64').toString('utf8'):null;
}
