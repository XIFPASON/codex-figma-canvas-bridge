# Figma Community 发布文案草稿

名称：Design Handoff Exporter

短描述：Export selected designs, previews and assets in one offline file.

## English description

Export the frames you select as a single `.figma.json` file. Keep the layer hierarchy, Auto Layout properties, text styles, accessible variable and component references, PNG previews, SVG shapes and original image assets together.

Select a frame, component, instance, group or section, click **Export design file**, and save the result. No account, API key, local server or separate desktop app is required for export. The plugin only reads your selection and makes no network requests.

The exported file is data, not production code. It can be read by development tools, including an optional Codex companion skill that decodes the embedded assets and helps implement the design in a separate local project. The plugin does not connect to an AI service or offer an MCP endpoint, automatic file watching or live synchronization. It does not generate code inside Figma.

Font binaries and unimported team libraries are not included. Referenced data must be accessible to your account. Complex masks and blend modes may need additional work during implementation. Resource warnings are included in the exported manifest. Visual fidelity depends on your implementation and fonts; pixel-perfect output is not guaranteed.

An optional companion skill is downloadable inside the plugin under **How to use the exported file**. Install it as `~/.codex/skills/figma-export-to-code/SKILL.md`, then provide your exported file to Codex. Skill installation is not necessary to use the exporter itself.

This is an independent tool and is not affiliated with Figma or OpenAI.

## 中文说明

选中 Frame、组件、实例、Group 或 Section，将图层、布局、文字、预览和真实素材导出为一个 `.figma.json` 文件。导出不需要注册、API Key、本地服务或其他桌面程序，不修改图层、不发送网络请求。

导出文件可用于独立开发工具中的设计交付。可选 Codex Skill 会在本地自动展开图片和 SVG，再辅助实现页面；插件本身不连接 AI、不提供 MCP、不自动同步或监控 Figma 文件，也不在 Figma 内生成代码。

字体文件不会打包；复杂混合和蒙版可能需要开发时调整，不承诺自动逐像素还原。

## 提交前必须补齐

- 发布者真实的支持邮箱或支持页面。
- 由发布者维护的公开使用说明和隐私说明地址。
- Figma 分配的真实插件 ID。
- 在 Figma 桌面及浏览器中运行市场候选版本，验证保存文件流程；当前仅做浏览器模拟及自动测试。

不要把这份草稿里的说明当作审核通过证明，也不要以“绕过官方 MCP 限额”宣传。
