# 數學公式測試文件

這是一份 KaTeX 數學渲染的測試文件，用於驗證行內公式、獨立公式、貨幣誤判與錯誤回退。

## 1. 行內公式 (Inline)

論文提出 $M+F$ 作為總量，其中 $E=mc^2$ 是質能等價，希臘字母如 $\alpha + \beta = \gamma$ 也能正常顯示。

另一種寫法 \(a^2 + b^2 = c^2\) 效果相同。

## 2. 獨立公式 (Display)

$$
M=\sum_{i=1}^{n}p_iq_i,\qquad T=M+F
$$

單行寫法 $$E = \frac{1}{2}mv^2$$ 同樣置中顯示，另一種寫法如下：

\[
\lim_{x \to \infty} \frac{1}{x} = 0, \qquad \int_{0}^{1} x^2 \, dx = \frac{1}{3}
\]

## 3. 複雜公式

二次公式：

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$

矩陣：

$$
A = \begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}, \qquad \det(A) = -2
$$

## 4. 不該渲染的情況

成本 $10 不應渲染，$5 和 $20 都是金額，`$x$` 在行內程式碼內保持原樣。

```python
# fenced code 內的 $y$ 也不渲染
price = "$99"
```

轉義 \$100 顯示為字面錢號。

## 5. 無效公式回退

無效公式 $\invalidcmd$ 應顯示錯誤而非空白。
