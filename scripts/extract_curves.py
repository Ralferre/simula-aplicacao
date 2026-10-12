#!/usr/bin/env python3
"""Extrator offline das curvas de vazao (Q) e potencia (P) do PDF Netzsch.

Fonte: "1.1.3 NDB 106-06 (602) - BOMBA NEMO - MODELOS CURVAS DIMENSOES.pdf".

Tecnica:
  - Calibracao pixel->valor por pagina, lida dos rotulos de texto dos eixos
    (page.get_text("words")). Nada e hardcoded; cada pagina pode ter escalas
    diferentes.
  - As curvas de dados sao escuras como a grade e nao sao extraiveis como
    vetores. Renderiza-se a pagina (zoom=5), converte-se para cinza e para cada
    coluna de RPM varrem-se os pixels escuros (gray<120) dentro da area do
    grafico, EXCLUINDO as linhas de grade (nas posicoes dos rotulos do eixo Y).
    Pixels escuros consecutivos (gap<=2 px) formam clusters; cada cluster e o
    cruzamento de uma curva de pressao.
  - Ajuste linear (grau 1) por cluster/pressao: Q = a*n + b, P = a*n + b.

Saidas:
  - scripts/data/raw-curves.json
  - scripts/data/catalog-control-points.md

Determinismo: mesma entrada -> mesma saida; chaves ordenadas.
Dependencias: pymupdf (import pymupdf), numpy. Nada mais.
"""

from __future__ import annotations

import json
import math
import os
import re
from dataclasses import dataclass, field

import numpy as np
import pymupdf

# ----------------------------------------------------------------------------
# Constantes
# ----------------------------------------------------------------------------
PDF_NAME = "1.1.3 NDB 106-06 (602) - BOMBA NEMO - MODELOS CURVAS DIMENSÕES.pdf"
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PDF_PATH = os.path.join(ROOT, PDF_NAME)
DATA_DIR = os.path.join(HERE, "data")
JSON_OUT = os.path.join(DATA_DIR, "raw-curves.json")
MD_OUT = os.path.join(DATA_DIR, "catalog-control-points.md")

PAGE_START = 26  # 0-based inclusive
PAGE_END = 85    # 0-based inclusive
ZOOM = 5
DARK_THRESHOLD = 120
GRID_HALF = ZOOM / 2 + 1  # faixa (px) excluida em torno de cada linha de grade
CLUSTER_GAP = 2           # px: pixels escuros com gap<= viram o mesmo cluster
R2_MIN = 0.9              # abaixo disso => needsReview

# A fronteira em Y (coordenadas PDF) que separa a sub-figura de vazao (em cima)
# da de potencia (embaixo). Determinada dinamicamente por pagina pelos marcadores
# de eixo ("[m3/h]" para Q e "kW" para P), com fallback.
FLOW_P_SPLIT_FALLBACK = 540.0


# ----------------------------------------------------------------------------
# Utilidades
# ----------------------------------------------------------------------------
def parse_decimal(token: str):
    """Converte '0,9' -> 0.9. Retorna None se nao for numerico puro."""
    t = token.strip().replace(",", ".")
    if re.fullmatch(r"-?\d+(\.\d+)?", t):
        return float(t)
    return None


def linfit(points):
    """Ajuste linear robusto valor = a*n + b.

    Faz um ajuste inicial, descarta outliers (pixels mal detectados: texto,
    insets, cruzamento de curvas) por desvio absoluto mediano (MAD) e reajusta.
    NAO inventa pontos; apenas remove deteccoes espurias.

    Retorna (fit_dict, inlier_points) ou (None, None).
    fit_dict: {a, b, r2, rmse} (floats arredondados).
    """
    if len(points) < 2:
        return None, None
    pts = [[float(p[0]), float(p[1])] for p in points]
    n = np.array([p[0] for p in pts])
    v = np.array([p[1] for p in pts])
    if np.allclose(n, n[0]):
        return None, None

    def _fit(nn, vv):
        a, b = np.polyfit(nn, vv, 1)
        pred = a * nn + b
        resid = vv - pred
        ss_res = float(np.sum(resid ** 2))
        ss_tot = float(np.sum((vv - np.mean(vv)) ** 2))
        r2 = 1.0 - ss_res / ss_tot if ss_tot > 1e-12 else 1.0
        rmse = float(math.sqrt(ss_res / len(vv)))
        return a, b, r2, rmse, resid

    a, b, r2, rmse, resid = _fit(n, v)

    # Rejeicao de outliers por MAD (robusta). So aplica se houver pontos de sobra.
    inlier_pts = pts
    if len(pts) >= 6:
        abs_res = np.abs(resid)
        med = np.median(abs_res)
        mad = np.median(np.abs(abs_res - med)) + 1e-12
        # limiar: 3.5 * (1.4826*MAD) acima da mediana dos residuos absolutos
        thresh = med + 3.5 * 1.4826 * mad
        mask = abs_res <= max(thresh, 1e-9)
        if mask.sum() >= max(2, int(0.6 * len(pts))) and mask.sum() < len(pts):
            n2, v2 = n[mask], v[mask]
            if not np.allclose(n2, n2[0]):
                a, b, r2, rmse, _ = _fit(n2, v2)
                inlier_pts = [pts[i] for i in range(len(pts)) if mask[i]]

    fit = {
        "a": round(float(a), 6),
        "b": round(float(b), 6),
        "r2": round(float(r2), 4),
        "rmse": round(float(rmse), 6),
    }
    inlier_pts = [[round(p[0], 2), round(p[1], 5)] for p in inlier_pts]
    return fit, inlier_pts


# ----------------------------------------------------------------------------
# Extracao de rotulos / calibracao
# ----------------------------------------------------------------------------
@dataclass
class AxisCalib:
    """Mapeia coordenada PDF -> valor por regressao linear.

    value = slope * pdf_coord + intercept
    """
    slope: float
    intercept: float
    labels: list  # [(pdf_coord, value), ...]

    def to_value(self, pdf_coord: float) -> float:
        return self.slope * pdf_coord + self.intercept

    def to_pdf(self, value: float) -> float:
        return (value - self.intercept) / self.slope


def fit_axis(label_pairs):
    """label_pairs: [(pdf_coord, value), ...] -> AxisCalib ou None."""
    if len(label_pairs) < 2:
        return None
    coords = np.array([c for c, _ in label_pairs], dtype=float)
    vals = np.array([v for _, v in label_pairs], dtype=float)
    if np.allclose(coords, coords[0]):
        return None
    slope, intercept = np.polyfit(coords, vals, 1)
    return AxisCalib(float(slope), float(intercept), sorted(label_pairs))


def collect_pressure_labels(words, y_lo, y_hi):
    """Agrupa rotulos de pressao por linha (mesmo y) na faixa [y_lo, y_hi].

    Retorna lista de (y_centro, label_normalizado) ordenada por y crescente.
    """
    # Seleciona tokens a direita do grafico com 'bar' ou valores numericos de pressao.
    cand = []
    for w in words:
        x0, y0, x1, y1, txt = w[0], w[1], w[2], w[3], w[4]
        if x0 < 430:
            continue
        yc = (y0 + y1) / 2.0
        if not (y_lo <= yc <= y_hi):
            continue
        cand.append((yc, x0, txt))
    if not cand:
        return []
    # agrupa por linha (y proximo)
    cand.sort()
    groups = []
    for yc, x0, txt in cand:
        placed = False
        for g in groups:
            if abs(g["y"] - yc) <= 4.0:
                g["items"].append((x0, txt))
                g["y"] = (g["y"] * g["n"] + yc) / (g["n"] + 1)
                g["n"] += 1
                placed = True
                break
        if not placed:
            groups.append({"y": yc, "n": 1, "items": [(x0, txt)]})
    labels = []
    for g in groups:
        items = sorted(g["items"])
        tokens = [t for _, t in items]
        # Monta "<valor> bar". Pode haver "0-2" "bar" ou "4" "6" "bar" (ruidoso).
        if "bar" not in [t.lower() for t in tokens]:
            continue
        value_tokens = []
        for t in tokens:
            if t.lower() == "bar":
                break
            value_tokens.append(t.strip())
        if not value_tokens:
            continue
        # normaliza: junta tokens de valor por espaco; mantem "0-2" intacto
        value_str = " ".join(value_tokens)
        value_str = re.sub(r"\s+", " ", value_str).strip()
        label = f"{value_str} bar"
        labels.append((g["y"], label))
    labels.sort()
    return labels


def _pressure_sort_key(label):
    """Chave numerica para ordenar pressoes. '0-2 bar' -> 2; '4 bar' -> 4."""
    m = re.findall(r"\d+(?:[.,]\d+)?", label)
    if not m:
        return 0.0
    # usa o ultimo numero (limite superior do intervalo)
    return float(m[-1].replace(",", "."))


# ----------------------------------------------------------------------------
# Modelo de uma sub-figura (vazao ou potencia)
# ----------------------------------------------------------------------------
@dataclass
class SubFigure:
    kind: str          # 'flow' | 'power'
    x_calib: AxisCalib
    y_calib: AxisCalib
    pressures: list    # [(y, label), ...] ordenado por y (topo->baixo)
    y_grid_pdf: list   # posicoes PDF das linhas de grade (rotulos Y)
    notes: list = field(default_factory=list)


def extract_subfigure(arr, sub: SubFigure):
    """Varre colunas de RPM, acha clusters escuros e ajusta uma reta por pressao.

    Retorna (curves, needs_review, review_reasons).
    """
    reasons = []
    xc, yc = sub.x_calib, sub.y_calib

    # Faixa de RPM util: do minimo (>0) ao maximo dos rotulos X.
    x_vals = [v for _, v in xc.labels]
    n_min_axis = min(x_vals)
    n_max_axis = max(x_vals)
    # evita o extremo esquerdo (eixo) e direito (borda/legenda)
    n_lo = max(n_min_axis + (n_max_axis - n_min_axis) * 0.05, 1.0)
    n_hi = n_max_axis * 0.98

    # Area vertical do grafico em pixels (dos rotulos Y).
    y_pdf_vals = [c for c, _ in yc.labels]
    y_top_pdf = min(y_pdf_vals)
    y_bot_pdf = max(y_pdf_vals)
    y_top_px = int(math.floor(y_top_pdf * ZOOM)) - 2
    y_bot_px = int(math.ceil(y_bot_pdf * ZOOM)) + 2
    y_top_px = max(0, y_top_px)
    y_bot_px = min(arr.shape[0] - 1, y_bot_px)

    grid_px = [g * ZOOM for g in sub.y_grid_pdf]

    def column_clusters(n_val):
        x_pdf = xc.to_pdf(n_val)
        col = int(round(x_pdf * ZOOM))
        if col < 0 or col >= arr.shape[1]:
            return None
        strip = arr[y_top_px:y_bot_px, max(0, col - 1):col + 2]
        # pega o pixel mais escuro de uma faixa de 3px de largura (robustez)
        column = strip.min(axis=1)
        dark_idx = np.where(column < DARK_THRESHOLD)[0] + y_top_px
        # exclui grade
        kept = [d for d in dark_idx if all(abs(d - g) > GRID_HALF for g in grid_px)]
        kept.sort()
        clusters = []
        cur = []
        for d in kept:
            if cur and d - cur[-1] > CLUSTER_GAP:
                clusters.append(cur)
                cur = []
            cur.append(d)
        if cur:
            clusters.append(cur)
        # centro de cada cluster em valor Y
        centers = []
        for c in clusters:
            py = float(np.mean(c)) / ZOOM
            centers.append(yc.to_value(py))
        return centers

    # Amostra varias colunas.
    n_samples = np.linspace(n_lo, n_hi, 60)
    per_n = []  # (n, [valores ordenados por pressao])
    for n_val in n_samples:
        centers = column_clusters(n_val)
        if centers is None:
            continue
        per_n.append((float(n_val), centers))

    # Descarta colunas sem nenhum pixel (fora do alcance da curva nessa pagina).
    per_n_nonempty = [(n, c) for (n, c) in per_n if len(c) > 0]
    if not per_n_nonempty:
        return [], True, ["nenhum pixel escuro detectado na area do grafico"]

    expected = len(sub.pressures)
    # Numero de clusters dominante entre as colunas COM dados. As curvas se
    # separam em RPM alto; o maior numero de clusters observado com frequencia
    # razoavel indica quantas curvas existem. Usamos a moda das colunas que
    # estao no terco superior de RPM entre as que tem dados.
    data_ns = [n for n, _ in per_n_nonempty]
    n_split = data_ns[len(data_ns) * 2 // 3]
    high = [(n, c) for (n, c) in per_n_nonempty if n >= n_split]
    high_counts = {}
    for _, centers in high:
        k = len(centers)
        high_counts[k] = high_counts.get(k, 0) + 1
    # dominante = contagem mais frequente; empate -> maior (curvas separadas)
    dominant = max(high_counts.items(), key=lambda kv: (kv[1], kv[0]))[0] if high_counts else 0

    if expected == 0:
        # sem rotulos de pressao: usa o numero dominante como fallback
        expected = dominant
        reasons.append("rotulos de pressao ausentes; usando contagem de clusters")

    if dominant != expected:
        reasons.append(
            f"clusters dominantes em RPM alto ({dominant}) != pressoes esperadas ({expected})"
        )

    # Ordena pressoes por valor numerico.
    # No topo->baixo (y crescente): flow => pressao cresce (menor Q embaixo);
    # power => pressao decresce (maior P no topo). Mas usamos a semantica fisica:
    #   flow: maior pressao => menor Q (curva mais baixa, maior valor Y em pixel)
    #   power: maior pressao => maior P (curva mais alta)
    press_sorted = sorted(sub.pressures, key=lambda p: _pressure_sort_key(p[1]))
    press_labels_by_value = [lbl for _, lbl in press_sorted]  # pressao crescente

    # Monta pontos por indice de curva (ordenado por valor Y crescente = de cima
    # para baixo no grafico). Depois mapeia indice->pressao conforme kind.
    # Em cada coluna com exatamente `expected` clusters, ordenamos os valores:
    #   centers vem em ordem de pixel (topo->baixo) => valor fisico:
    #     flow: topo = maior Q (menor pressao); baixo = menor Q (maior pressao)
    #     power: topo = maior P (maior pressao); baixo = menor P (menor pressao)
    # column_clusters retorna centros ja convertidos para VALOR (nao pixel),
    # em ordem de pixel topo->baixo. Para flow, valor decresce topo->baixo;
    # para power idem (eixo Y cresce para cima). Entao centers[0] = topo.
    curve_points = {i: [] for i in range(expected)} if expected > 0 else {}
    for n_val, centers in per_n:
        if len(centers) != expected or expected == 0:
            continue
        # centers em ordem topo->baixo. Index 0 = curva superior.
        for i, val in enumerate(centers):
            curve_points[i].append([round(n_val, 2), round(val, 5)])

    # Mapeia indice de curva (topo->baixo) para rotulo de pressao.
    #   flow:  topo = maior vazao = MENOR pressao -> index crescente = pressao crescente
    #   power: topo = maior potencia = MAIOR pressao -> index crescente = pressao DECRESCENTE
    curves = []
    if expected > 0 and all(len(curve_points[i]) >= 2 for i in range(expected)) \
            and len(press_labels_by_value) == expected:
        for i in range(expected):
            if sub.kind == "flow":
                label = press_labels_by_value[i]          # topo->baixo = pressao crescente
            else:  # power
                label = press_labels_by_value[expected - 1 - i]  # topo->baixo = pressao decrescente
            pts = curve_points[i]
            fit, inliers = linfit(pts)
            if fit is None:
                reasons.append(f"ajuste falhou para curva idx {i}")
                continue
            curves.append({
                "pressureLabel": label,
                "points": inliers,
                "fit": fit,
            })
        # ordena saida por pressao crescente (determinismo)
        curves.sort(key=lambda c: _pressure_sort_key(c["pressureLabel"]))
    else:
        reasons.append("mapeamento cluster->pressao incompleto")

    # valida R2
    for c in curves:
        if c["fit"]["r2"] < R2_MIN:
            reasons.append(f"R2 baixo ({c['fit']['r2']}) em {c['pressureLabel']}")

    needs_review = bool(reasons) or len(curves) == 0
    return curves, needs_review, reasons


# ----------------------------------------------------------------------------
# Processamento de pagina
# ----------------------------------------------------------------------------
def detect_x_axis_rows(words):
    """Detecta as DUAS linhas de rotulos do eixo X (0..1000).

    Os rotulos do eixo X sao multiplos de 100 (100..1000) alinhados numa unica
    linha Y por sub-figura. A sub-figura de vazao fica em cima (menor Y) e a de
    potencia embaixo (maior Y). Agrupa por Y e retorna as duas linhas com mais
    rotulos: (y_flow_x, y_power_x). Qualquer uma pode ser None.
    """
    rows = {}  # y_arredondado -> lista de (xc, v)
    for w in words:
        txt = w[4]
        if not re.fullmatch(r"\d+", txt):
            continue
        v = int(txt)
        if v % 100 != 0 or not (100 <= v <= 1000):
            continue
        yc = (w[1] + w[3]) / 2.0
        xc = (w[0] + w[2]) / 2.0
        # agrupa por Y com tolerancia
        placed = False
        for key in list(rows.keys()):
            if abs(key - yc) <= 3.0:
                rows[key].append((xc, v))
                placed = True
                break
        if not placed:
            rows[yc] = [(xc, v)]
    # mantem apenas linhas com >=2 rotulos (eixo real)
    valid = {y: pts for y, pts in rows.items() if len(pts) >= 2}
    if not valid:
        return None, None
    ys_sorted = sorted(valid.keys())
    y_flow_x = ys_sorted[0]
    y_power_x = ys_sorted[-1] if len(ys_sorted) >= 2 else None
    return y_flow_x, y_power_x, valid


def build_subfigure(words, kind, arr):
    """Monta calibracao e pressoes para a sub-figura 'flow' ou 'power'.

    Delimita a regiao vertical de cada sub-figura pelas duas linhas de rotulos
    do eixo X (vazao em cima, potencia embaixo).
    """
    detected = detect_x_axis_rows(words)
    if detected[0] is None:
        return SubFigure(kind=kind, x_calib=None, y_calib=None,
                         pressures=[], y_grid_pdf=[])
    y_flow_x, y_power_x, valid_rows = detected

    # Regiao vertical de cada sub-figura e selecao do bloco X correto.
    if kind == "flow":
        x_row_y = y_flow_x
        # Y labels do grafico de vazao ficam ACIMA do eixo X de vazao.
        y_region = (0.0, y_flow_x - 1.0)
        # Pressoes de vazao: acima do eixo X de vazao.
        press_region = (0.0, y_flow_x - 1.0)
    else:
        if y_power_x is None:
            return SubFigure(kind=kind, x_calib=None, y_calib=None,
                             pressures=[], y_grid_pdf=[])
        x_row_y = y_power_x
        # Y labels de potencia ficam entre o eixo X de vazao e o eixo X de potencia.
        y_region = (y_flow_x + 1.0, y_power_x - 1.0)
        press_region = (y_flow_x + 1.0, y_power_x - 1.0)

    # ---- Rotulos do eixo X da sub-figura ----
    x_pts = valid_rows.get(x_row_y, [])
    # inclui o '0' se existir perto da mesma linha (valor 0 nao e multiplo
    # capturado pelo filtro >=100).
    for w in words:
        if w[4] == "0":
            yc = (w[1] + w[3]) / 2.0
            if abs(yc - x_row_y) <= 6.0:
                x_pts.append(((w[0] + w[2]) / 2.0, 0.0))
    xmap = {}
    for xc, v in x_pts:
        xmap.setdefault(float(v), []).append(xc)
    x_pairs = [(float(np.mean(xs)), v) for v, xs in xmap.items()]
    x_calib = fit_axis(x_pairs)

    # ---- Rotulos do eixo Y ----
    # Os rotulos ficam a esquerda da area do grafico. Para bombas pequenas sao
    # decimais estreitos (x0~152); para bombas grandes sao inteiros largos
    # (ex. '350', '180') que comecam mais a esquerda (x0~135). Usamos a borda
    # DIREITA do token (x1), que fica proxima do eixo (~162), como ancora.
    y_pairs = []
    for w in words:
        x0, x1 = w[0], w[2]
        if not (120 < x0 and x1 < 168):
            continue
        yc = (w[1] + w[3]) / 2.0
        if not (y_region[0] <= yc <= y_region[1]):
            continue
        val = parse_decimal(w[4])
        if val is None:
            continue
        y_pairs.append((yc, val))
    y_calib = fit_axis(y_pairs)

    # ---- Pressoes ----
    pressures = collect_pressure_labels(words, press_region[0], press_region[1])

    y_grid_pdf = [c for c, _ in y_pairs]

    return SubFigure(
        kind=kind,
        x_calib=x_calib,
        y_calib=y_calib,
        pressures=pressures,
        y_grid_pdf=y_grid_pdf,
    )


def process_page(doc, pidx):
    page = doc[pidx]
    words = page.get_text("words")
    codes = [w[4] for w in words if re.fullmatch(r"NM\d{3}-+\d+[A-Z]", w[4])]
    has_q = any(w[4] == "[m3/h]" for w in words)
    has_p = any("kW" in w[4] for w in words)

    # Pagina de curva valida: exatamente 1 codigo e pelo menos um dos graficos.
    if len(codes) != 1 or not (has_q or has_p):
        return None

    code = codes[0]

    # Render em cinza.
    mat = pymupdf.Matrix(ZOOM, ZOOM)
    pix = page.get_pixmap(matrix=mat, colorspace=pymupdf.csGRAY)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)

    record = {
        "code": code,
        "page": pidx + 1,  # pagina humana
        "flow": [],
        "power": [],
        "needsReview": False,
    }
    review_reasons = []

    if has_q:
        sf = build_subfigure(words, "flow", arr)
        if sf.x_calib is None or sf.y_calib is None:
            review_reasons.append("flow: calibracao falhou")
            record["needsReview"] = True
        else:
            curves, nr, reasons = extract_subfigure(arr, sf)
            record["flow"] = curves
            if nr:
                record["needsReview"] = True
                review_reasons += [f"flow: {r}" for r in reasons]
    else:
        review_reasons.append("sem grafico de vazao")

    if has_p:
        sf = build_subfigure(words, "power", arr)
        if sf.x_calib is None or sf.y_calib is None:
            review_reasons.append("power: calibracao falhou")
            record["needsReview"] = True
        else:
            curves, nr, reasons = extract_subfigure(arr, sf)
            record["power"] = curves
            if nr:
                record["needsReview"] = True
                review_reasons += [f"power: {r}" for r in reasons]

    record["reviewReasons"] = sorted(set(review_reasons))
    return record


# ----------------------------------------------------------------------------
# Pontos de controle (markdown)
# ----------------------------------------------------------------------------
def control_points_md(records):
    lines = [
        "# Pontos de controle para validacao humana",
        "",
        "Gerado por `scripts/extract_curves.py`. Compare cada ponto com o PDF",
        f"`{PDF_NAME}`. Os valores vem do ajuste linear `valor = a*n + b`.",
        "",
    ]
    for rec in records:
        lines.append(f"## {rec['code']} (pagina {rec['page']})")
        if rec["needsReview"]:
            lines.append(f"- **needsReview = true**: {'; '.join(rec.get('reviewReasons', []))}")
        for kind, unit, sym in (("flow", "m3/h", "Q"), ("power", "kW", "P")):
            for curve in rec[kind]:
                a = curve["fit"]["a"]
                b = curve["fit"]["b"]
                pts = curve["points"]
                ns = [p[0] for p in pts]
                lo, hi = min(ns), max(ns)
                mid = (lo + hi) / 2.0
                sample_ns = sorted(set(round(x) for x in (lo, mid, hi)))
                label = "vazao" if kind == "flow" else "potencia"
                for n in sample_ns:
                    val = a * n + b
                    lines.append(
                        f"- {rec['code']} {label} {curve['pressureLabel']}: "
                        f"n={n} -> {sym}={val:.4f} {unit} (R2={curve['fit']['r2']})"
                    )
        lines.append("")
    return "\n".join(lines)


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    if not os.path.exists(PDF_PATH):
        raise SystemExit(f"PDF nao encontrado: {PDF_PATH}")
    os.makedirs(DATA_DIR, exist_ok=True)

    doc = pymupdf.open(PDF_PATH)
    records = []
    skipped = []
    for pidx in range(PAGE_START, PAGE_END + 1):
        rec = process_page(doc, pidx)
        if rec is None:
            skipped.append(pidx + 1)
            continue
        records.append(rec)

    # Determinismo: ordena por codigo depois pagina.
    records.sort(key=lambda r: (r["code"], r["page"]))

    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")

    with open(MD_OUT, "w", encoding="utf-8") as f:
        f.write(control_points_md(records))
        f.write("\n")

    # ---- Resumo ----
    total = len(records)
    needs = sum(1 for r in records if r["needsReview"])
    total_curves = sum(len(r["flow"]) + len(r["power"]) for r in records)
    codes = [r["code"] for r in records]

    print("=" * 70)
    print("RESUMO DA EXTRACAO")
    print("=" * 70)
    print(f"Paginas de curva processadas : {total}")
    print(f"Curvas extraidas (flow+power): {total_curves}")
    print(f"Registros com needsReview    : {needs}")
    print(f"Paginas puladas (sem curva)  : {skipped}")
    print(f"Codigos ({len(codes)}): {', '.join(codes)}")
    print()
    if needs:
        print("Registros marcados para revisao:")
        for r in records:
            if r["needsReview"]:
                print(f"  - {r['code']} (p{r['page']}): {'; '.join(r.get('reviewReasons', []))}")
    print()
    print(f"JSON: {JSON_OUT}")
    print(f"MD  : {MD_OUT}")


if __name__ == "__main__":
    main()
