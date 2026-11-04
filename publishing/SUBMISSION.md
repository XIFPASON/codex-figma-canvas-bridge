# Community 候选版发布步骤

## 版本边界

- `output/community`：无网络的离线导出候选版，独立 UI，输出单个 `.figma.json`。这是准备提交的版本。
- 根目录的 `manifest.json` 和 `output/releases`：已有本地同步开发版，不能误当作市场候选版提交。
- 单文件资源提取由用户选择的本地开发工具执行，插件不提供实时 AI 接入。

Figma 当前审核指南表示，可能不批准重复其原生 AI / MCP 能力、规避付费能力，或通过官方 MCP 之外提供程序化 AI 访问的插件。此候选版采用用户主动离线导出，但具体用途仍需如实向审核团队披露；不能保证获批。

官方依据：

- https://help.figma.com/hc/en-us/articles/360039958914-Plugin-and-widget-review-guidelines
- https://developers.figma.com/docs/plugins/manifest/

## 构建

先在 Figma 的开发插件管理中创建自己的插件，取得 Figma 分配的插件 ID；不要使用原开发版的 `codex-design-exporter-local`。

在本项目目录执行（替换为真实数字 ID）：

```powershell
$env:FIGMA_PLUGIN_ID = '你的真实数字插件ID'
npm run build:community
```

将 `output/community/manifest.json` 作为该开发插件的 manifest。未提供 ID 时生成的 manifest 不会填入假的 ID，属于尚不能直接正式提交的候选产物。

## 实际验证

在 Figma 桌面及网页中验证：无选区、无效选区、多个 Frame、混合文字、图片、SVG、变量别名、离线、超大选区与导出失败后的重试。验证保存 `.figma.json` 后能展开对应图片和所有根节点预览。自动测试和浏览器模拟不代替这些验证。

## 发布内容

1. 使用 `LISTING.md` 的真实文案，补齐支持方式、文档和隐私说明公开地址。
2. 素材位于 `publishing/assets`。候选插件截图采用模拟选区，只展示实际界面，不代表已通过 Figma 客户端测试。
3. 在你的 Figma 账号中进入该开发插件的发布入口，核对 ID、名称、权限、文案、图标和预览。
4. 明确披露独立开发工具和可选 Codex Skill 的使用方式；不要将用途伪装为完全无关工具来绕过审核。
5. 确认后提交审核。通过审核且公开发布后，其他人才可以在 Community 里直接运行插件，不需要手工导入 manifest。

真正发布需要插件所有者账号操作及 Figma 审核。当前产物不等于已发布，也不构成保证通过。
