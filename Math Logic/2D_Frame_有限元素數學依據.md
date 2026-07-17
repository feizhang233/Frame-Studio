# 2D Frame 有限元素 Project：數學依據

## 0. 範圍、假設與統一約定

本文以資料夾內教材第 3 章（桿／桁架）、第 4 章（梁）及第 5 章（平面框架）摘錄為主要依據，目標是建立可直接轉化為程式的線性靜力 2D Frame 有限元素公式。本文採用：

- 線彈性材料、微小位移與微小轉角；
- 直線、等截面二節點單元，單元內 \(E,A,I\) 為常數；
- 軸向變形採線性桿理論；
- 彎曲採 Euler–Bernoulli 梁理論，忽略橫向剪切變形；
- 剛接節點傳遞軸力、剪力與彎矩，每個節點有三個自由度。

教材 4.1.pdf 同時介紹 Euler–Bernoulli 與 Timoshenko 梁；本 Project 依題目範圍只使用前者，因此不引入剪切面積、剪切模數或剪切修正係數。

### 0.1 座標、節點與自由度

單元 \(e=(i,j)\) 的局部 \(x'\) 軸由節點 \(i\) 指向節點 \(j\)，局部 \(y'\) 軸由 \(x'\) 軸逆時針旋轉 \(90^\circ\) 得到。全局座標為 \((x,y)\)。

每個節點的全局自由度順序固定為

$$
\mathbf d_n=
\begin{bmatrix}u_n&v_n&\phi_n\end{bmatrix}^{\mathsf T},
$$

其中 \(u_n\) 沿全局 \(+x\)、\(v_n\) 沿全局 \(+y\)，而 \(\phi_n\) 繞 \(+z\) 逆時針為正。單元自由度向量固定為

$$
\mathbf d_e=
\begin{bmatrix}
u_i&v_i&\phi_i&u_j&v_j&\phi_j
\end{bmatrix}^{\mathsf T},
\qquad
\mathbf d'_e=
\begin{bmatrix}
u'_i&v'_i&\phi'_i&u'_j&v'_j&\phi'_j
\end{bmatrix}^{\mathsf T}.
$$

局部節點端力順序與自由度一一對應：

$$
\mathbf q'_e=
\begin{bmatrix}
f'_{xi}&f'_{yi}&m'_i&f'_{xj}&f'_{yj}&m'_j
\end{bmatrix}^{\mathsf T}.
$$

其中局部力沿 \(+x'\)、\(+y'\) 為正，端彎矩逆時針為正。後文以 \(\mathbf p_e^{0\prime}\) 表示單元荷載的局部一致等效節點力；它不是端力 \(\mathbf q'_e\)。

---

## 1. 桿單元：位移函數、應變與軸向剛度

教材位置：3.1.pdf，教材頁 75–77；3.2.pdf，教材頁 79–81。

### 1.1 線性位移插值

二節點桿只有兩個局部軸向自由度 \(u'_i,u'_j\)。令局部座標 \(x'\in[0,L]\)，先假設一次多項式

$$
u'(x')=a_1+a_2x'.
$$

施加端點條件

$$
u'(0)=u'_i,
\qquad
u'(L)=u'_j,
$$

得到

$$
a_1=u'_i,
\qquad
a_2=\frac{u'_j-u'_i}{L}.
$$

因此

$$
u'(x')=
\left(1-\frac{x'}{L}\right)u'_i+
\frac{x'}{L}u'_j
=\mathbf N_a\mathbf d'_a,
$$

其中

$$
\mathbf N_a=
\begin{bmatrix}N_{a1}&N_{a2}\end{bmatrix}
=
\begin{bmatrix}1-\dfrac{x'}L&\dfrac{x'}L\end{bmatrix},
\qquad
\mathbf d'_a=
\begin{bmatrix}u'_i&u'_j\end{bmatrix}^{\mathsf T}.
$$

\(N_{a1}+N_{a2}=1\)，所以剛體平移 \(u'_i=u'_j\) 可被精確表示，且不產生應變。

### 1.2 應變、應力與軸力

小變形軸向應變為

$$
\varepsilon_x=\frac{du'}{dx'}
=\mathbf B_a\mathbf d'_a,
\qquad
\mathbf B_a=
\begin{bmatrix}-\dfrac1L&\dfrac1L\end{bmatrix}.
$$

由 Hooke 定律及截面合力定義，

$$
\sigma_x=E\varepsilon_x,
\qquad
N=A\sigma_x
=\frac{EA}{L}(u'_j-u'_i).
$$

本文件約定 \(N>0\) 為拉力。若桿內無分佈軸向荷載，作用於單元兩端的局部軸力分量為

$$
f'_{xi}=-N,
\qquad
f'_{xj}=N.
$$

### 1.3 軸向剛度

將上式寫成節點力—位移關係：

$$
\begin{bmatrix}f'_{xi}\\f'_{xj}\end{bmatrix}
=
\frac{EA}{L}
\begin{bmatrix}
1&-1\\
-1&1
\end{bmatrix}
\begin{bmatrix}u'_i\\u'_j\end{bmatrix}.
$$

故桿單元局部軸向剛度為

$$
\boxed{
\mathbf k'_a=
\frac{EA}{L}
\begin{bmatrix}
1&-1\\
-1&1
\end{bmatrix}}
$$

其物理意義是：剛度只對相對位移 \(u'_j-u'_i\) 有反應；兩端相同的平移屬於零能量剛體運動。

---

## 2. Euler–Bernoulli 梁單元：插值、曲率與彎曲剛度

教材位置：4.1.pdf，教材頁 170–176，尤其式 (4.1.2)–(4.1.14)。

### 2.1 梁假設與 Hermite 三次插值

Euler–Bernoulli 假設截面彎曲後仍保持平面並垂直於中性軸。梁的局部橫向位移為 \(v'(x')\)，小轉角為

$$
\phi'(x')=\frac{dv'}{dx'}.
$$

每端有橫向位移及轉角，共四個自由度，因此取完整三次多項式

$$
v'(x')=a_1+a_2x'+a_3x'^2+a_4x'^3.
$$

令 \(\xi=x'/L\)，施加

$$
v'(0)=v'_i,
\quad
\frac{dv'}{dx'}(0)=\phi'_i,
\quad
v'(L)=v'_j,
\quad
\frac{dv'}{dx'}(L)=\phi'_j,
$$

可得 Hermite 插值

$$
v'(x')=
H_1v'_i+H_2\phi'_i+H_3v'_j+H_4\phi'_j
=\mathbf H\mathbf d'_b,
$$

其中

$$
\mathbf d'_b=
\begin{bmatrix}v'_i&\phi'_i&v'_j&\phi'_j\end{bmatrix}^{\mathsf T},
$$

$$
\begin{aligned}
H_1(\xi)&=1-3\xi^2+2\xi^3,\\
H_2(\xi)&=L(\xi-2\xi^2+\xi^3),\\
H_3(\xi)&=3\xi^2-2\xi^3,\\
H_4(\xi)&=L(-\xi^2+\xi^3).
\end{aligned}
$$

\(H_1,H_3\) 對應位移自由度，無量綱；\(H_2,H_4\) 對應轉角自由度，量綱為長度。這一點在程式中可用來檢查矩陣量綱。

### 2.2 應變、曲率、彎矩與剪力

距中性軸 \(y'\) 的纖維，其彎曲軸向位移與應變為

$$
u_x^{(b)}(x',y')=-y'\frac{dv'}{dx'},
\qquad
\varepsilon_x^{(b)}=-y'\frac{d^2v'}{dx'^2}.
$$

依教材的正號約定，

$$
\kappa(x')=\frac{d^2v'}{dx'^2},
\qquad
M(x')=EI\kappa(x'),
\qquad
V(x')=\frac{dM}{dx'}=EI\frac{d^3v'}{dx'^3}.
$$

同時

$$
\sigma_x=-Ey'\kappa=-\frac{M y'}{I}.
$$

將插值微分兩次，得到

$$
\kappa=\mathbf B_b\mathbf d'_b,
$$

$$
\mathbf B_b=
\begin{bmatrix}
\dfrac{-6+12\xi}{L^2}&
\dfrac{-4+6\xi}{L}&
\dfrac{6-12\xi}{L^2}&
\dfrac{-2+6\xi}{L}
\end{bmatrix}.
$$

### 2.3 彎曲剛度推導

梁的彎曲應變能為

$$
U_b=\frac12\int_0^L EI\kappa^2\,dx'
=\frac12\mathbf d_b'^{\mathsf T}
\left(\int_0^L\mathbf B_b^{\mathsf T}EI\mathbf B_b\,dx'\right)
\mathbf d'_b.
$$

因此

$$
\mathbf k'_b=
\int_0^L\mathbf B_b^{\mathsf T}EI\mathbf B_b\,dx'.
$$

對常數 \(EI\) 積分後，

$$
\boxed{
\mathbf k'_b=
\frac{EI}{L^3}
\begin{bmatrix}
12&6L&-12&6L\\
6L&4L^2&-6L&2L^2\\
-12&-6L&12&-6L\\
6L&2L^2&-6L&4L^2
\end{bmatrix}}
$$

且

$$
\begin{bmatrix}
f'_{yi}\\m'_i\\f'_{yj}\\m'_j
\end{bmatrix}
=\mathbf k'_b
\begin{bmatrix}
v'_i\\\phi'_i\\v'_j\\\phi'_j
\end{bmatrix}
$$

適用於單元內沒有構件荷載的情形；若有分佈荷載，端力恢復時尚須扣除一致等效節點力，見第 7 節。

### 2.4 截面內力與節點端力的正號對應

教材的「梁截面正號」與「節點端力正號」在兩端並不完全相同。依 4.1.pdf 教材頁 176：

$$
f'_{yi}=V(0),
\qquad
m'_i=-M(0),
\qquad
f'_{yj}=-V(L),
\qquad
m'_j=M(L).
$$

因此不能把左端節點彎矩 \(m'_i\) 直接當成截面彎矩 \(M(0)\)。此處是後處理最容易發生正負號錯誤的位置。

---

## 3. 軸向與彎曲組合成 2D Frame 單元

教材位置：5.1.pdf，教材頁 241–242，式 (5.1.5)–(5.1.10)。

Euler–Bernoulli 線性理論中，局部軸向與彎曲變形互不耦合。將第 1 節的二自由度軸向剛度與第 2 節的四自由度彎曲剛度，按統一順序

$$
\mathbf d'_e=
\begin{bmatrix}
u'_i&v'_i&\phi'_i&u'_j&v'_j&\phi'_j
\end{bmatrix}^{\mathsf T}
$$

交錯排列，即得局部 2D Frame 剛度矩陣。定義

$$
a=\frac{EA}{L},
\qquad
b=\frac{12EI}{L^3},
\qquad
c=\frac{6EI}{L^2},
\qquad
d=\frac{4EI}{L},
\qquad
e=\frac{2EI}{L},
$$

則

$$
\boxed{
\mathbf k'_e=
\begin{bmatrix}
a&0&0&-a&0&0\\
0&b&c&0&-b&c\\
0&c&d&0&-c&e\\
-a&0&0&a&0&0\\
0&-b&-c&0&b&-c\\
0&c&e&0&-c&d
\end{bmatrix}}
$$

其中：

- 第 \(1,4\) 行／列是軸向項；
- 第 \(2,3,5,6\) 行／列是橫向位移—轉角的彎曲項；
- 軸向與彎曲的交叉區塊為零，是局部直桿、線性小變形假設的結果；
- \(\mathbf k'_e\) 對稱，反映互等功；未施加支承前含三個平面剛體模態。

若同時需要位移場，可寫成

$$
\begin{bmatrix}u'(x')\\v'(x')\end{bmatrix}
=\mathbf N_f(x')\mathbf d'_e,
$$

$$
\mathbf N_f=
\begin{bmatrix}
N_{a1}&0&0&N_{a2}&0&0\\
0&H_1&H_2&0&H_3&H_4
\end{bmatrix}.
$$

這個矩陣也直接用於第 6 節的一致等效節點力。

---

## 4. 局部與全局座標轉換

教材位置：3.3.pdf–3.4.pdf，教材頁 82–88；5.1.pdf，教材頁 240–242。

### 4.1 方向餘弦

由節點座標計算

$$
\Delta x=x_j-x_i,
\qquad
\Delta y=y_j-y_i,
\qquad
L=\sqrt{(\Delta x)^2+(\Delta y)^2},
$$

$$
c=\cos\alpha=\frac{\Delta x}{L},
\qquad
s=\sin\alpha=\frac{\Delta y}{L},
$$

其中 \(\alpha\) 從全局 \(+x\) 軸逆時針量到局部 \(+x'\) 軸。程式中宜直接由 \(\Delta x/L,\Delta y/L\) 求 \(c,s\)，不必先求角度。

### 4.2 位移轉換矩陣

單一節點的轉換為

$$
\begin{bmatrix}u'\\v'\\\phi'\end{bmatrix}
=
\mathbf R
\begin{bmatrix}u\\v\\\phi\end{bmatrix},
\qquad
\mathbf R=
\begin{bmatrix}
c&s&0\\
-s&c&0\\
0&0&1
\end{bmatrix}.
$$

轉角繞共同的 \(z'=z\) 軸，因此 \(\phi'=\phi\)。二節點單元的轉換矩陣為

$$
\boxed{
\mathbf T_e=
\begin{bmatrix}
\mathbf R&\mathbf 0\\
\mathbf 0&\mathbf R
\end{bmatrix}},
\qquad
\boxed{\mathbf d'_e=\mathbf T_e\mathbf d_e}.
$$

\(\mathbf T_e\) 為正交矩陣：

$$
\mathbf T_e^{-1}=\mathbf T_e^{\mathsf T},
\qquad
\mathbf T_e^{\mathsf T}\mathbf T_e=\mathbf I.
$$

### 4.3 力與剛度轉換

由虛功不變

$$
\delta\mathbf d_e^{\mathsf T}\mathbf q_e
=
\delta\mathbf d_e'^{\mathsf T}\mathbf q'_e
=
\delta\mathbf d_e^{\mathsf T}\mathbf T_e^{\mathsf T}\mathbf q'_e,
$$

可得

$$
\boxed{\mathbf q_e=\mathbf T_e^{\mathsf T}\mathbf q'_e},
\qquad
\mathbf q'_e=\mathbf T_e\mathbf q_e.
$$

對無構件荷載的局部關係 \(\mathbf q'_e=\mathbf k'_e\mathbf d'_e\)，代入位移與力轉換：

$$
\mathbf q_e
=\mathbf T_e^{\mathsf T}\mathbf k'_e\mathbf T_e\mathbf d_e.
$$

故全局座標下的單元剛度為

$$
\boxed{\mathbf k_e=\mathbf T_e^{\mathsf T}\mathbf k'_e\mathbf T_e}.
$$

同理，局部一致等效節點力轉為全局座標：

$$
\boxed{\mathbf p_e^0=\mathbf T_e^{\mathsf T}\mathbf p_e^{0\prime}}.
$$

程式宜使用矩陣乘法完成轉換，不需手寫教材式 (5.1.11) 的展開矩陣，可降低方向餘弦符號錯誤。

---

## 5. 單元剛度矩陣的整體組裝

教材位置：3.1.pdf，教材頁 76–77；4.2.pdf–4.3.pdf，教材頁 180–188；5.2.pdf，教材頁 243–252。

若共有 \(n\) 個節點，全局自由度數為 \(3n\)。採一基底編號時，節點 \(n\) 的自由度為

$$
\operatorname{dof}(n)=
\begin{bmatrix}3n-2&3n-1&3n\end{bmatrix};
$$

單元 \(e=(i,j)\) 的位置向量為

$$
\mathbf I_e=
\begin{bmatrix}
3i-2&3i-1&3i&3j-2&3j-1&3j
\end{bmatrix}.
$$

令布林抽取矩陣 \(\mathbf A_e\) 滿足

$$
\mathbf d_e=\mathbf A_e\mathbf d,
$$

則單元對總位能的貢獻導出

$$
\boxed{
\mathbf K=\sum_e\mathbf A_e^{\mathsf T}
\mathbf k_e\mathbf A_e}
=
\sum_e\mathbf A_e^{\mathsf T}
\mathbf T_e^{\mathsf T}\mathbf k'_e\mathbf T_e
\mathbf A_e.
$$

程式實作等價於

$$
\mathbf K[\mathbf I_e,\mathbf I_e]\mathrel{+}=\mathbf k_e.
$$

共享節點的同一自由度會接收所有相連單元的剛度貢獻，這就是直接剛度法的「疊加」。組裝完成後 \(\mathbf K\) 應保持對稱；若 \(E,A,I,L>0\) 而組裝後明顯不對稱，通常表示自由度順序或轉換矩陣使用錯誤。

---

## 6. 節點荷載與分佈荷載的一致等效節點力

教材位置：4.4.pdf，教材頁 195–205，尤其式 (4.4.1)–(4.4.11)；框架例題見 5.2.pdf，教材頁 248–257。

### 6.1 直接節點荷載

作用在節點的全局集中力與集中力矩直接加入全局荷載向量

$$
\mathbf P=
\begin{bmatrix}
P_{x1}&P_{y1}&M_1&\cdots&P_{xn}&P_{yn}&M_n
\end{bmatrix}^{\mathsf T}.
$$

方向符合第 0 節正號約定；不需再做等效化。

对节点 $n$，直接节点荷载的三个分量依自由度的共轭关系组装为

$$
\mathbf p_n=
\begin{bmatrix}F_{xn}&F_{yn}&M_{zn}\end{bmatrix}^{\mathsf T}
\quad\longrightarrow\quad
\begin{bmatrix}P_{3n-2}\\P_{3n-1}\\P_{3n}\end{bmatrix}
\mathrel{+}=\mathbf p_n.
$$

其中 $M_{zn}$ 与转角自由度 \(\phi_n\) 共轭，因为其虚功项为
\(M_{zn}\,\delta\phi_n\)。因此直接施加在 node 上的 moment 只需写入该
节点的旋转荷载分量；它不是构件分布荷载，不需要形函数积分或一致等效化。
正 \(M_z\) 按本文约定为绕 \(+z\) 逆时针。

### 6.2 工作等效原理

令作用於單元的局部分佈荷載為

$$
\mathbf w'(x')=
\begin{bmatrix}q_x(x')&q_y(x')\end{bmatrix}^{\mathsf T},
$$

其中 \(q_x,q_y\) 分別沿局部 \(+x',+y'\) 為正。分佈荷載對任意相容虛位移所作的功為

$$
\delta W
=\int_0^L
\delta
\begin{bmatrix}u'&v'\end{bmatrix}
\mathbf w'\,dx'.
$$

代入

$$
\begin{bmatrix}u'\\v'\end{bmatrix}
=\mathbf N_f\mathbf d'_e
$$

並要求與節點力的虛功

$$
\delta W=\delta\mathbf d_e'^{\mathsf T}\mathbf p_e^{0\prime}
$$

對任意 \(\delta\mathbf d'_e\) 相等，得到

$$
\boxed{
\mathbf p_e^{0\prime}
=\int_0^L\mathbf N_f^{\mathsf T}(x')
\mathbf w'(x')\,dx'}.
$$

這不是只要求合力與合矩相等，而是要求對所採位移插值的工作相等，所以稱為一致等效節點力。

### 6.3 均佈荷載特例

若只有常數橫向均佈荷載 \(q_y=q\)，且 \(q>0\) 表示沿局部 \(+y'\)，則

$$
\boxed{
\mathbf p_e^{0\prime}=
\begin{bmatrix}
0\\[2pt]
\dfrac{qL}{2}\\[2pt]
\dfrac{qL^2}{12}\\[2pt]
0\\[2pt]
\dfrac{qL}{2}\\[2pt]
-\dfrac{qL^2}{12}
\end{bmatrix}}.
$$

教材以 \(w>0\) 表示向下荷載；若局部 \(+y'\) 向上，則 \(q=-w\)，所以教材式 (4.4.10) 為

$$
\mathbf p_e^{0\prime}=
\begin{bmatrix}
0\\[2pt]
-\dfrac{wL}{2}\\[2pt]
-\dfrac{wL^2}{12}\\[2pt]
0\\[2pt]
-\dfrac{wL}{2}\\[2pt]
\dfrac{wL^2}{12}
\end{bmatrix}.
$$

若只有常數軸向均佈荷載 \(q_x=q_a\)，由相同工作等效式直接得到

$$
\mathbf p_e^{0\prime}=
\begin{bmatrix}
q_aL/2&0&0&q_aL/2&0&0
\end{bmatrix}^{\mathsf T}.
$$

一般變化荷載直接對上式作解析積分或數值積分，不應把任意分佈荷載一律替換成均佈荷載公式。

### 6.4 轉換、組裝與總平衡式

先將局部等效力轉至全局：

$$
\mathbf p_e^0=\mathbf T_e^{\mathsf T}\mathbf p_e^{0\prime},
$$

再組裝

$$
\boxed{
\mathbf P^0=
\sum_e\mathbf A_e^{\mathsf T}\mathbf p_e^0}.
$$

把直接節點荷載與構件荷載合併：

$$
\bar{\mathbf P}=\mathbf P+\mathbf P^0.
$$

在自由自由度上，支承反力為零，因此求解式是

$$
\boxed{(\mathbf K\mathbf d)_f=\bar{\mathbf P}_f}.
$$

若以 \(\mathbf R\) 表示支承反力，完整平衡式為

$$
\boxed{\mathbf K\mathbf d=\mathbf P+\mathbf P^0+\mathbf R}.
$$

教材式 (4.4.8) 把直接節點力及反力合稱為 \(\mathbf F=\mathbf P+\mathbf R\)，故寫成

$$
\mathbf F=\mathbf K\mathbf d-\mathbf P^0.
$$

兩種寫法完全等價。等效節點力 \(\mathbf P^0\) 與固定端反力符號相反；兩者不可混用。

---

## 7. 邊界條件、位移、反力與單元內力恢復

教材位置：3.1.pdf–3.2.pdf，教材頁 76–78；4.3.pdf–4.4.pdf，教材頁 182–205；5.2.pdf，教材頁 243–260。

### 7.1 邊界條件與位移求解

將自由自由度記為 \(f\)，已知／受拘束自由度記為 \(c\)，分割方程：

$$
\begin{bmatrix}
\mathbf K_{ff}&\mathbf K_{fc}\\
\mathbf K_{cf}&\mathbf K_{cc}
\end{bmatrix}
\begin{bmatrix}
\mathbf d_f\\\mathbf d_c
\end{bmatrix}
=
\begin{bmatrix}
\bar{\mathbf P}_f\\\bar{\mathbf P}_c
\end{bmatrix}.
$$

自由位移由

$$
\boxed{
\mathbf K_{ff}\mathbf d_f
=\bar{\mathbf P}_f-\mathbf K_{fc}\mathbf d_c}
$$

求得。固定或鉸／滾支承通常有 \(\mathbf d_c=\mathbf 0\)，但非零指定沉陷或轉角仍可用同一分割式處理。程式應解線性方程組，不應顯式計算 \(\mathbf K_{ff}^{-1}\)。

若 \(\mathbf K_{ff}\) 奇異，首先檢查支承是否不足、節點是否未連接、是否存在零長度單元，或某單元的 \(E,A,I\) 是否為零。

對斜向滾支承，教材 5.3.pdf 的做法是先把該節點位移轉至支承局部座標，再約束支承法向位移；等價地，可施加線性條件

$$
n_xu_n+n_yv_n=\bar d_n.
$$

不能在未對齊支承方向時任意把全局 \(u_n\) 或 \(v_n\) 設為零。

本 Project 对所有倾斜 support 采用统一的支座局部坐标法。令支座局部
\(+u_s\) 轴相对全局 \(+X\) 逆时针旋转 \(\theta_s\)，则单节点变换为

$$
\mathbf d_s=\mathbf R_s\mathbf d_g,
\qquad
\mathbf R_s=
\begin{bmatrix}
\cos\theta_s&\sin\theta_s&0\\
-\sin\theta_s&\cos\theta_s&0\\
0&0&1
\end{bmatrix}.
$$

全模型以这些 \(\mathbf R_s\) 组成块对角正交矩阵 \(\mathbf S\)；无倾角
节点对应单位块。于是

$$
\boxed{\mathbf d_s=\mathbf S\mathbf d_g},
\qquad
\boxed{\bar{\mathbf P}_s=\mathbf S\bar{\mathbf P}_g},
\qquad
\boxed{\mathbf K_s=\mathbf S\mathbf K_g\mathbf S^{\mathsf T}}.
$$

第二、三个式子由 \(\mathbf d_g=\mathbf S^{\mathsf T}\mathbf d_s\) 与虚功不变
得到。随后在支座坐标中按原有方式划分 \(f/c\) 自由度并求解

$$
\boxed{
\mathbf K_{s,ff}\mathbf d_{s,f}
=\bar{\mathbf P}_{s,f}
-\mathbf K_{s,fc}\mathbf d_{s,c}}.
$$

求得支座坐标位移后再转换回全局坐标：

$$
\boxed{\mathbf d_g=\mathbf S^{\mathsf T}\mathbf d_s}.
$$

例如只约束倾斜 roller 的局部 \(v_s\) 时，实际约束式为

$$
v_s=-\sin\theta_s\,u_g+\cos\theta_s\,v_g=\bar v_s,
$$

而局部 \(u_s\) 方向仍可自由滑动。\(\theta_s=0\) 时以上公式严格退化为
原来的全局 \(u/v\) 约束，因此旧模型不需要改变数值结果。

### 7.2 支座反力

回填完整位移向量後，計算全局殘差

$$
\boxed{
\mathbf r=\mathbf K\mathbf d-(\mathbf P+\mathbf P^0)}.
$$

当所有支座角度均为零时，理想计算中：

$$
\mathbf r_f\approx\mathbf 0,
\qquad
\boxed{\mathbf R_c=\mathbf r_c}.
$$

有倾斜支座时，不能再按同一索引直接把全局 \(\mathbf r_f\) 解释为自由
方向残差，或把全局 \(\mathbf r_c\) 单独解释为全部支座反力。完整
\(\mathbf r_g\) 仍是全局 \([F_x,F_y,M_z]\) 反力，便于检查整体平衡；
自由/约束方向的判断应转到支座坐标：

$$
\boxed{\mathbf r_s=\mathbf S\mathbf r_g},
\qquad
(\mathbf r_s)_f\approx\mathbf 0,
\qquad
\mathbf R_{s,c}=(\mathbf r_s)_c.
$$

因此倾斜 roller 在全局 \(X\)、\(Y\) 分量上都可能出现反力，这并不表示
滑动方向受约束；判断时应查看其局部切向反力是否为零。

在支座坐标中，亦可由分割矩阵直接得到

$$
\boxed{
\mathbf R_c=
\mathbf K_{cf}\mathbf d_f+
\mathbf K_{cc}\mathbf d_c-
\bar{\mathbf P}_c}.
$$

計算反力時必須扣除施加在受拘束自由度上的直接節點荷載與一致等效節點力；只計算 \(\mathbf K\mathbf d\) 會在有構件荷載時得到錯誤反力。

### 7.3 單元端力恢復

對每個單元依序執行：

$$
\mathbf d_e=\mathbf A_e\mathbf d,
\qquad
\mathbf d'_e=\mathbf T_e\mathbf d_e,
$$

$$
\boxed{
\mathbf q'_e=
\mathbf k'_e\mathbf d'_e-
\mathbf p_e^{0\prime}}.
$$

若單元沒有構件荷載，\(\mathbf p_e^{0\prime}=\mathbf 0\)；若有分佈荷載或單元內集中荷載，扣除此向量是必要步驟。這是教材式 (4.4.11) 及框架例題 5.2、5.3 的核心。

局部端力向量的六個分量依序為

$$
\mathbf q'_e=
\begin{bmatrix}
f'_{xi}&f'_{yi}&m'_i&f'_{xj}&f'_{yj}&m'_j
\end{bmatrix}^{\mathsf T}.
$$

### 7.4 截面軸力、彎矩與剪力

由位移直接恢復軸向量：

$$
\varepsilon_x=
\frac{u'_j-u'_i}{L},
\qquad
\sigma_x=E\varepsilon_x,
\qquad
N=EA\varepsilon_x.
$$

彎曲量為

$$
\kappa(x')=\mathbf B_b(x')\mathbf d'_b,
\qquad
M(x')=EI\kappa(x'),
\qquad
V(x')=EI\frac{d^3v'}{dx'^3}.
$$

若單元有橫向分佈荷載，建立平衡型內力圖時應從已恢復的端力出發，按教材正號使用

$$
\frac{dV}{dx'}=q_y(x'),
\qquad
\frac{dM}{dx'}=V(x'),
$$

並以第 2.4 節的節點端力—截面內力對應作為邊界條件。如此可避免只用三次位移插值的導數而遺漏構件荷載對單元內部剪力、彎矩分佈的貢獻。

---

## 8. 材料間的記號與表述差異

已核對的核心公式未發現彼此矛盾；但不同章節存在下列記號或正號語境差異，程式中不可混用：

| 項目 | 教材中的差異 | 本文件統一方式 |
|---|---|---|
| 座標記號 | 第 4 章在梁軸與全局軸重合時直接寫 \(x,y\)；第 3、5 章用 \(x',y'\) 表示局部軸 | 所有單元量一律加撇號，總體量不加撇號 |
| 自由度順序 | 梁為 \([v_i,\phi_i,v_j,\phi_j]\)；框架為 \([u_i,v_i,\phi_i,u_j,v_j,\phi_j]\) | 全部框架運算固定使用後者；梁子矩陣嵌入索引 \(2,3,5,6\) |
| 角度符號 | 教材以 \(\theta\) 表示單元方位、\(\phi\) 表示節點轉角 | 本文以 \(\alpha\) 表示方位，以 \(\phi\) 表示節點轉角 |
| 梁截面彎矩與端彎矩 | 左端 \(m'_i=-M(0)\)，右端 \(m'_j=M(L)\) | 後處理明確套用第 2.4 節，不直接等同 |
| 向下均佈荷載 | 教材令 \(w>0\) 表示向下，因此等效力帶負的 \(y\) 分量 | 先以 \(q_y\) 沿 \(+y'\) 為正；向下時代入 \(q_y=-w\) |
| 固定端反力／等效節點力 | 教材明確指出兩者互為反號 | 組裝使用 \(\mathbf p^0\)；端力恢復使用 \(\mathbf k'\mathbf d'-\mathbf p^{0\prime}\) |
| 梁模型 | 4.1.pdf 同時給出 Euler–Bernoulli 與 Timoshenko | 本 Project 只採 Euler–Bernoulli，不混入剪切修正項 |

---

## 9. 可直接轉成程式的計算流程

1. 讀入節點座標、元素連接關係、\(E,A,I\)、節點荷載、構件荷載及支承條件。
2. 對每個元素由節點座標求 \(L,c,s\)，檢查 \(L>0\)。
3. 依第 3 節建立 \(\mathbf k'_e\)，依第 4 節建立 \(\mathbf T_e\)。
4. 計算 \(\mathbf k_e=\mathbf T_e^{\mathsf T}\mathbf k'_e\mathbf T_e\)，組裝至 \(\mathbf K\)。
5. 依第 6 節計算 \(\mathbf p_e^{0\prime}\)，轉成 \(\mathbf p_e^0\) 並組裝至 \(\mathbf P^0\)；另組裝直接節點荷載 \(\mathbf P\)。
6. 由支座角度建立 \(\mathbf S\)，计算 \(\mathbf K_s=\mathbf S\mathbf K\mathbf S^{\mathsf T}\) 与 \(\bar{\mathbf P}_s=\mathbf S\bar{\mathbf P}\)。
7. 在支座坐标中依自由／受拘束自由度分割矩阵，求 \(\mathbf d_s\)，再回转为 \(\mathbf d=\mathbf S^{\mathsf T}\mathbf d_s\)。
8. 由 \(\mathbf r=\mathbf K\mathbf d-(\mathbf P+\mathbf P^0)\) 取得全局支座反力，并以 \(\mathbf S\mathbf r\) 检查局部自由方向残差。
9. 對每個元素恢復 \(\mathbf d'_e\) 及 \(\mathbf q'_e=\mathbf k'_e\mathbf d'_e-\mathbf p_e^{0\prime}\)。
10. 以總體力與力矩平衡、支座局部自由方向殘差、單元平衡及 \(\mathbf K\) 對稱性進行驗證。

建議的最低數值檢查為

$$
\frac{\|(\mathbf S\mathbf r)_f\|}{\max(1,\|\bar{\mathbf P}\|)}<\text{tolerance},
\qquad
\frac{\|\mathbf K-\mathbf K^{\mathsf T}\|}{\max(1,\|\mathbf K\|)}<\text{tolerance}.
$$

---

## 10. 教材對應索引

| 主題 | 主要材料 |
|---|---|
| 桿位移函數、應變、軸向剛度 | 3.1.pdf、3.2.pdf、3.3.pdf |
| 二維向量與桿剛度座標轉換 | 3.3.pdf、3.4.pdf、3.5.pdf |
| Euler–Bernoulli 梁插值與彎曲剛度 | 4.1.pdf、4.2.pdf |
| 梁組裝、邊界條件、反力及端力 | 4.2.pdf、4.3.pdf |
| 分佈荷載與工作等效節點力 | 4.4.pdf |
| 2D Frame 局部剛度與轉換 | 5.1.pdf、5.2.pdf |
| 框架例題、構件荷載與內力恢復 | 5.2.pdf |
| 斜向支承 | 5.3.pdf |
