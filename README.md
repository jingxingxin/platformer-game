# 横版平台跳跃打怪

一个纯前端 Canvas 小游戏，打开 `index.html` 即可运行。

## 操作

- 移动: `A/D` 或 `←/→`
- 跳跃: `W` / `Space` / `↑`
- 攻击: `J`

## 发布到 GitHub Pages

仓库已包含自动发布工作流：`/.github/workflows/deploy-pages.yml`

按下面步骤即可公开访问：

1. 在 GitHub 新建仓库（例如 `platformer-game`）。
2. 在本地项目目录执行：

```bash
git init
git add .
git commit -m "init game"
git branch -M main
git remote add origin <你的仓库URL>
git push -u origin main
```

3. 打开 GitHub 仓库页面：
   `Settings -> Pages -> Build and deployment`
4. `Source` 选择 `GitHub Actions`。
5. 等待 Actions 里的 `Deploy To GitHub Pages` 成功。
6. 访问生成的公网地址：
   `https://<你的GitHub用户名>.github.io/<仓库名>/`
