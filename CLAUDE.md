# ColourFuel 项目接手指南

先读 [需求交接文档](design/requirements-handoff.md)，再读 [README](README.md)、[视觉规范](design/visual-system.md) 和 [标准份与演示价格](design/standard-portions.md)。涉及界面时同时参考 [项目 UI skill](.agents/skills/colourfuel-ui/SKILL.md)；涉及数据迁移时读 [迁移记录](migrations/README.md)。[视觉验收记录](design/visual-qa.md) 是历史测试证据，不代表所有旧状态仍是当前要求。

需求交接文档区分了用户明确要求、已实现行为、开发者提出的测试参数和未完成事项。不要把示例、演示金额、建议配方或待办当成已核定的商业事实。新的用户指示优先于这些文件。仅阅读本文件不构成修改或发布授权。

## 必须保持的产品行为

- 只做 Bowl，绝不添加 Wrap。保留八款产品；Crispy Pork、Signature Salmon 为研发测试、不可订购。
- 打开产品就直接显示食材、用量和 Make it yours；不要要求再次选择配方或点击 Build your own 才能定制。
- 客户餐品页用拖拽滑杆调整每碗标准份数，实时换算克重、营养和演示价格。不要恢复份数加减按钮、Recipe name 或 Bowls in batch 输入框。独立菜谱工作区保留命名和批量能力。
- 酱料必选，提供推荐搭配，也允许选其他候选；首份酱料计入演示基础价。保留食材库、营养浏览、菜谱分享、保存、厨房清单及 Nutrition Passport，不能为重做一个页面丢掉其他功能。
- 保留用户选择的 A / Colour Pop：白底、黄蓝紫红、粗体无衬线标题、现有图片、统一 4:3 食物卡片和适度动效。尊重减少动态效果设置。
- 食材信息来自持久 PostgreSQL；按营养元素的排序和相对百分比由数据库动态计算。不能写死“所有食物 Top 2%”。保留来源、原/熟状态、单位、参考估算标签和缺失覆盖。
- 成人 RI/NRV/AI 是比较参考，不是每日最低摄入量。酱料营养未核算，不能当作零或展示为完整 Bowl 营养；Passport 的基础食材估算与完整餐品待核算范围必须清楚。
- 演示加价是用户允许的虚构测试金额，网站上必须显示 DEMO ONLY / NOT A QUOTE；真实成本仍未核定。不得把 demo 金额标记为 verified，也不得编造库存、已完成的过敏原审核或可订购状态。
- iPhone App（用户 2026-11-20 确认）：这些金额就是正式价格，App 中直接显示价格、不标 DEMO ONLY；App 去掉 “Concept preview / not available to order” 等演示字样以准备上架 App Store。App 仍没有下单功能，不得声称可订购。

## 开发与发布

- 实际应用在仓库根目录。`previews/colourfuel-bowl/` 是历史副本，不是当前产品的开发入口。
- 使用 Node 22。安装依赖后执行 `npm run check` 和 `npm test`；55 项测试是本次交接时的基线，不是永远固定的数量。文档修改检查相对链接、事实和前后一致性即可；部署流水线仍会运行全部检查。
- `npm start` 需要现有 Cloud SQL / IAM 配置。没有数据库凭据时可运行离线测试，但不得把 fixtures 当作线上或静默离线营养回退。需要前端预览时使用明确的只读生产公开 API 代理，并运行当前根目录代码；不要把旧预览副本当成新版。
- 用户已明确：说“上传/更新到 GitHub”就是要进入 **main 并部署**。临时分支/PR 只作为中间步骤，不要停在未合并 PR。检查 main 是否有他人的新提交，正常合并或快进，避免强制覆盖。
- main 由现有 Cloud Build 触发器部署到 Cloud Run。核对构建结果、线上 `/health`、`/api/catalog`、关键文件版本及关键交互后再报告上线成功。只要求预览时保持本地。
- 不把迁移夹带进普通部署，不把凭据写入仓库。部署事实与未完成的验证要如实区分。
- 数据库权限（用户 2026-11-20 指示）：运行账号只读，例外仅为迁移 007 的 `colourfuel_catalog.add_photo_food(jsonb)` 与迁移 008 的 `set_photo_food_image` / `photo_image_bytes` 执行权限——拍照发现库里没有的食材时，按包装营养表或 USDA FoodData Central 记录自动补充进库（标记来源与“未人工复核”），不能修改或删除现有数据，营养值不得由模型编造；配图只用 Wikimedia Commons 开放授权（CC0/公有领域/CC BY/CC BY-SA）照片并保存署名，不用顾客照片。迁移用 `gcloud sql import sql … --user=postgres` 执行。

若接到新的改动，先说明它影响哪些已确认需求，再完成实现和相应验证。不要仅因为接手项目而进行整体重写、迁移平台或自行选择待办实施。
