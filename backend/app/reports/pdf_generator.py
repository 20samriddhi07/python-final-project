import os
import json
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from app.core.config import REPORTS_DIR, PROJECT_NAME, PROJECT_SUBTITLE, VERSION
from app.core.state import state

class ReportGenerator:
    @classmethod
    def generate_pdf_report(cls, output_filepath: str) -> str:
        """Generates a comprehensive engineering project report in PDF format."""
        doc = SimpleDocTemplate(
            output_filepath,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Heading1"],
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#0f172a"),
            alignment=1, # Center
            spaceAfter=8
        )
        subtitle_style = ParagraphStyle(
            "DocSubtitle",
            parent=styles["Normal"],
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#0284c7"),
            alignment=1,
            spaceAfter=20
        )
        h2_style = ParagraphStyle(
            "SectionH2",
            parent=styles["Heading2"],
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#1e293b"),
            spaceBefore=14,
            spaceAfter=8
        )
        body_style = ParagraphStyle(
            "Body",
            parent=styles["Normal"],
            fontSize=9.5,
            leading=13,
            textColor=colors.HexColor("#334155")
        )
        table_cell_style = ParagraphStyle(
            "TableCell",
            parent=styles["Normal"],
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#1e293b")
        )

        story = []

        # Title & Header
        story.append(Paragraph(f"<b>{PROJECT_NAME}</b>", title_style))
        story.append(Paragraph(f"{PROJECT_SUBTITLE} (v{VERSION})", subtitle_style))
        story.append(Spacer(1, 10))

        # Project Abstract
        story.append(Paragraph("<b>1. Executive Summary & Objectives</b>", h2_style))
        abstract_text = (
            "This report presents offline, feature-space experiments for machine-learning network intrusion "
            "detection. FGSM and PGD are used with differentiable MLP models; black-box methods are used for "
            "non-differentiable tree models. Adversarial training and final comparisons use separate training "
            "and hold-out test partitions. Feature-level constraints do not prove packet-level realizability."
        )
        story.append(Paragraph(abstract_text, body_style))
        story.append(Spacer(1, 10))

        # Dataset Preprocessing Information
        story.append(Paragraph("<b>2. Dataset & Preprocessing Configuration</b>", h2_style))
        prep_meta = state.preprocessed_metadata or {}
        source_file = prep_meta.get("source_file")
        if source_file == "cicids2017_sample.csv":
            dataset_note = "Synthetic demonstration data; not the full CICIDS2017 corpus"
        elif source_file:
            dataset_note = "Uploaded dataset; verify its source before interpreting results"
        else:
            dataset_note = "Not available"
        dataset_data = [
            [Paragraph("<b>Parameter</b>", table_cell_style), Paragraph("<b>Value</b>", table_cell_style)],
            [Paragraph("Dataset Source", table_cell_style), Paragraph(str(prep_meta.get("source_file", "Not available")), table_cell_style)],
            [Paragraph("Dataset provenance", table_cell_style), Paragraph(dataset_note, table_cell_style)],
            [Paragraph("Total Feature Dimensions", table_cell_style), Paragraph(str(prep_meta.get("feature_count", "Not available")), table_cell_style)],
            [Paragraph("Training Samples", table_cell_style), Paragraph(str(prep_meta.get("train_samples", "Not available")), table_cell_style)],
            [Paragraph("Testing Samples (Hold-out)", table_cell_style), Paragraph(str(prep_meta.get("test_samples", "Not available")), table_cell_style)],
            [Paragraph("Preprocessing", table_cell_style), Paragraph("Imputation and StandardScaler fit on training split only" if prep_meta else "Not available", table_cell_style)],
            [Paragraph("Classification Mode", table_cell_style), Paragraph("Binary (0 = BENIGN, 1 = ATTACK)", table_cell_style)]
        ]
        t_ds = Table(dataset_data, colWidths=[200, 320])
        t_ds.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(t_ds)
        story.append(Spacer(1, 12))

        # Model Performance & Baseline
        story.append(Paragraph("<b>3. Model Baseline Performance (Clean Test Set)</b>", h2_style))
        from app.models.model_manager import ModelManager
        models_manifest = ModelManager.get_trained_models()

        if models_manifest:
            model_table_data = [
                [
                    Paragraph("<b>Model Name</b>", table_cell_style),
                    Paragraph("<b>Accuracy</b>", table_cell_style),
                    Paragraph("<b>Precision</b>", table_cell_style),
                    Paragraph("<b>Recall</b>", table_cell_style),
                    Paragraph("<b>F1-Score</b>", table_cell_style),
                    Paragraph("<b>FPR</b>", table_cell_style),
                    Paragraph("<b>FNR</b>", table_cell_style),
                    Paragraph("<b>Confusion Matrix (TN, FP, FN, TP)</b>", table_cell_style),
                    Paragraph("<b>Inference Time</b>", table_cell_style)
                ]
            ]
            for m in models_manifest[:5]:
                mets = m.get("metrics", {})
                accuracy = mets.get("accuracy")
                precision = mets.get("precision")
                recall = mets.get("recall")
                f1_score = mets.get("f1_score")
                fpr = mets.get("fpr")
                fnr = mets.get("fnr")
                confusion_matrix = mets.get("confusion_matrix")
                confusion_summary = (
                    f"{confusion_matrix[0][0]}, {confusion_matrix[0][1]}, "
                    f"{confusion_matrix[1][0]}, {confusion_matrix[1][1]}"
                    if isinstance(confusion_matrix, list)
                    and len(confusion_matrix) == 2
                    and all(isinstance(row, list) and len(row) == 2 for row in confusion_matrix)
                    else "N/A"
                )
                inference_time = mets.get("inference_time_ms")
                model_table_data.append([
                    Paragraph(str(m.get("model_type")), table_cell_style),
                    Paragraph(f"{accuracy*100:.2f}%" if accuracy is not None else "N/A", table_cell_style),
                    Paragraph(f"{precision:.3f}" if precision is not None else "N/A", table_cell_style),
                    Paragraph(f"{recall:.3f}" if recall is not None else "N/A", table_cell_style),
                    Paragraph(f"{f1_score:.3f}" if f1_score is not None else "N/A", table_cell_style),
                    Paragraph(f"{fpr*100:.2f}%" if fpr is not None else "N/A", table_cell_style),
                    Paragraph(f"{fnr*100:.2f}%" if fnr is not None else "N/A", table_cell_style),
                    Paragraph(confusion_summary, table_cell_style),
                    Paragraph(f"{inference_time:.2f} ms" if inference_time is not None else "N/A", table_cell_style)
                ])
            t_models = Table(model_table_data, colWidths=[80, 42, 42, 42, 42, 42, 42, 100, 70])
            t_models.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ('PADDING', (0, 0), (-1, -1), 4),
            ]))
            story.append(t_models)
        else:
            story.append(Paragraph("No trained models recorded yet.", body_style))
        story.append(Spacer(1, 12))

        # Adversarial Attack Simulation Findings
        story.append(Paragraph("<b>4. Adversarial Attack Vulnerability Analysis</b>", h2_style))
        attack_records = state.recent_attacks
        if attack_records:
            atk_table_data = [
                [
                    Paragraph("<b>Target Model</b>", table_cell_style),
                    Paragraph("<b>Attack Method</b>", table_cell_style),
                    Paragraph("<b>Epsilon</b>", table_cell_style),
                    Paragraph("<b>Clean Detection</b>", table_cell_style),
                    Paragraph("<b>Adversarial Detection</b>", table_cell_style),
                    Paragraph("<b>Attack Success Rate (ASR)</b>", table_cell_style)
                ]
            ]
            for atk in attack_records[:5]:
                atk_table_data.append([
                    Paragraph(str(atk.get("target_model")), table_cell_style),
                    Paragraph(str(atk.get("actual_method")), table_cell_style),
                    Paragraph(str(atk.get("epsilon")), table_cell_style),
                    Paragraph(f"{atk.get('clean_detection_rate')}%", table_cell_style),
                    Paragraph(f"{atk.get('adversarial_detection_rate')}%", table_cell_style),
                    Paragraph(f"<b>{atk.get('attack_success_rate')}%</b>", table_cell_style)
                ])
            t_atk = Table(atk_table_data, colWidths=[110, 110, 60, 80, 80, 80])
            t_atk.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#fee2e2")),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ('PADDING', (0, 0), (-1, -1), 4),
            ]))
            story.append(t_atk)
        else:
            story.append(Paragraph("No attack simulations recorded in this session.", body_style))
        story.append(Spacer(1, 12))

        # Defence Mechanisms Results
        story.append(Paragraph("<b>5. Defence & Adversarial Training Evaluation</b>", h2_style))
        def_records = state.recent_defence_results
        if def_records:
            latest_def = def_records[0]
            base_m = latest_def["baseline_metrics"]
            def_m = latest_def["defended_metrics"]
            comp = latest_def["comparison"]

            def_table_data = [
                [
                    Paragraph("<b>Metric</b>", table_cell_style),
                    Paragraph("<b>Base Model</b>", table_cell_style),
                    Paragraph("<b>Defended Model</b>", table_cell_style),
                    Paragraph("<b>Improvement / Impact</b>", table_cell_style)
                ],
                [
                    Paragraph("Clean Accuracy", table_cell_style),
                    Paragraph(f"{base_m['clean_accuracy']}%", table_cell_style),
                    Paragraph(f"{def_m['clean_accuracy']}%", table_cell_style),
                    Paragraph(f"{comp['clean_accuracy_impact_pct']}% impact", table_cell_style)
                ],
                [
                    Paragraph("Adversarial Accuracy under Attack", table_cell_style),
                    Paragraph(f"{base_m['adversarial_accuracy']}%", table_cell_style),
                    Paragraph(f"{def_m['adversarial_accuracy']}%", table_cell_style),
                    Paragraph(f"+{round(def_m['adversarial_accuracy'] - base_m['adversarial_accuracy'], 2)}% gain", table_cell_style)
                ],
                [
                    Paragraph("Attack Success Rate (Evasion)", table_cell_style),
                    Paragraph(f"{base_m['attack_success_rate']}%", table_cell_style),
                    Paragraph(f"{def_m['attack_success_rate']}%", table_cell_style),
                    Paragraph(f"<b>-{comp['asr_reduction_pct']}% reduction</b>", table_cell_style)
                ]
            ]
            t_def = Table(def_table_data, colWidths=[150, 110, 110, 150])
            t_def.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#dcfce7")),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ('PADDING', (0, 0), (-1, -1), 4),
            ]))
            story.append(t_def)
        else:
            story.append(Paragraph("No adversarial defence experiments recorded yet.", body_style))
        story.append(Spacer(1, 14))

        # Project Engineering Conclusions
        story.append(Paragraph("<b>6. Engineering Conclusions & College Project Takeaways</b>", h2_style))
        conclusion_text = (
            "The metrics in this report are taken from the saved model evaluations and experiments above. "
            "Interpret them in the context of the selected dataset and split. The included CICIDS2017 sample "
            "is generated synthetic traffic; results on it do not establish generalization to the full CICIDS2017 "
            "dataset. No attack or defence effectiveness claim is made when the corresponding measured result "
            "is unavailable."
        )
        story.append(Paragraph(conclusion_text, body_style))

        doc.build(story)
        return output_filepath
