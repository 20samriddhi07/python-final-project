import os
import numpy as np
import pandas as pd
from app.core.config import DATASET_RAW_DIR

def generate_cicids2017_sample(output_path: str, n_samples: int = 3500):
    np.random.seed(42)
    
    # Class distribution: ~65% BENIGN, 15% DDoS, 10% PortScan, 7% DoS Hulk, 3% Bot
    n_benign = int(n_samples * 0.65)
    n_ddos = int(n_samples * 0.15)
    n_portscan = int(n_samples * 0.10)
    n_dos = int(n_samples * 0.07)
    n_bot = n_samples - (n_benign + n_ddos + n_portscan + n_dos)
    
    records = []
    
    # 1. BENIGN Flows
    for _ in range(n_benign):
        dest_port = np.random.choice([80, 443, 53, 22, 8080, 5353, 123, 445])
        flow_duration = int(np.random.exponential(scale=500000) + 100)
        tot_fwd_pkts = int(np.random.negative_binomial(5, 0.4) + 1)
        tot_bwd_pkts = int(np.random.negative_binomial(6, 0.35) + 1)
        
        fwd_len_mean = np.random.uniform(40, 600)
        fwd_len_max = fwd_len_mean + np.random.uniform(50, 800)
        fwd_len_min = max(0.0, fwd_len_mean - np.random.uniform(10, 40))
        fwd_len_std = np.random.uniform(10, 150)
        tot_len_fwd = tot_fwd_pkts * fwd_len_mean
        
        bwd_len_mean = np.random.uniform(100, 1200)
        bwd_len_max = bwd_len_mean + np.random.uniform(100, 1000)
        bwd_len_min = max(0.0, bwd_len_mean - np.random.uniform(20, 80))
        bwd_len_std = np.random.uniform(20, 300)
        tot_len_bwd = tot_bwd_pkts * bwd_len_mean
        
        flow_bytes_s = (tot_len_fwd + tot_len_bwd) / (flow_duration / 1e6 + 1e-5)
        flow_pkts_s = (tot_fwd_pkts + tot_bwd_pkts) / (flow_duration / 1e6 + 1e-5)
        
        records.append({
            "Destination Port": dest_port,
            "Flow Duration": flow_duration,
            "Total Fwd Packets": tot_fwd_pkts,
            "Total Backward Packets": tot_bwd_pkts,
            "Total Length of Fwd Packets": tot_len_fwd,
            "Total Length of Bwd Packets": tot_len_bwd,
            "Fwd Packet Length Max": fwd_len_max,
            "Fwd Packet Length Min": fwd_len_min,
            "Fwd Packet Length Mean": fwd_len_mean,
            "Fwd Packet Length Std": fwd_len_std,
            "Bwd Packet Length Max": bwd_len_max,
            "Bwd Packet Length Min": bwd_len_min,
            "Bwd Packet Length Mean": bwd_len_mean,
            "Bwd Packet Length Std": bwd_len_std,
            "Flow Bytes/s": flow_bytes_s,
            "Flow Packets/s": flow_pkts_s,
            "Flow IAT Mean": flow_duration / (tot_fwd_pkts + tot_bwd_pkts + 1),
            "Flow IAT Std": np.random.uniform(100, 5000),
            "Flow IAT Max": flow_duration * 0.8,
            "Flow IAT Min": np.random.uniform(1, 50),
            "Fwd IAT Total": flow_duration * 0.95,
            "Bwd IAT Total": flow_duration * 0.9,
            "Fwd Header Length": tot_fwd_pkts * 20,
            "Bwd Header Length": tot_bwd_pkts * 20,
            "Fwd Packets/s": tot_fwd_pkts / (flow_duration / 1e6 + 1e-5),
            "Bwd Packets/s": tot_bwd_pkts / (flow_duration / 1e6 + 1e-5),
            "Min Packet Length": min(fwd_len_min, bwd_len_min),
            "Max Packet Length": max(fwd_len_max, bwd_len_max),
            "Packet Length Mean": (tot_len_fwd + tot_len_bwd) / (tot_fwd_pkts + tot_bwd_pkts),
            "Packet Length Std": np.random.uniform(50, 250),
            "FIN Flag Count": int(np.random.choice([0, 1], p=[0.8, 0.2])),
            "SYN Flag Count": int(np.random.choice([0, 1], p=[0.7, 0.3])),
            "RST Flag Count": int(np.random.choice([0, 1], p=[0.95, 0.05])),
            "PSH Flag Count": int(np.random.choice([0, 1], p=[0.6, 0.4])),
            "ACK Flag Count": 1,
            "URG Flag Count": 0,
            "Down/Up Ratio": tot_bwd_pkts / max(1, tot_fwd_pkts),
            "Average Packet Size": (tot_len_fwd + tot_len_bwd) / (tot_fwd_pkts + tot_bwd_pkts),
            "Init_Win_bytes_forward": int(np.random.choice([8192, 29200, 65535, 14600])),
            "Init_Win_bytes_backward": int(np.random.choice([8192, 29200, 65535, 14600])),
            "min_seg_size_forward": 20,
            "Active Mean": np.random.uniform(0, 1000),
            "Idle Mean": np.random.uniform(0, 5000),
            "Label": "BENIGN"
        })

    # 2. DDoS Flows (High packet rate, short duration or burst, target port 80/443, high SYN or PSH)
    for _ in range(n_ddos):
        dest_port = np.random.choice([80, 443])
        flow_duration = int(np.random.uniform(1000, 80000))
        tot_fwd_pkts = int(np.random.uniform(15, 120))
        tot_bwd_pkts = int(np.random.uniform(0, 4))
        
        fwd_len_mean = np.random.uniform(400, 1460)
        fwd_len_max = 1460.0
        fwd_len_min = 300.0
        fwd_len_std = np.random.uniform(0, 50)
        tot_len_fwd = tot_fwd_pkts * fwd_len_mean
        
        bwd_len_mean = 0.0 if tot_bwd_pkts == 0 else np.random.uniform(40, 100)
        bwd_len_max = bwd_len_mean * 1.5
        bwd_len_min = 0.0
        bwd_len_std = 10.0
        tot_len_bwd = tot_bwd_pkts * bwd_len_mean
        
        flow_bytes_s = (tot_len_fwd + tot_len_bwd) / (flow_duration / 1e6 + 1e-5)
        flow_pkts_s = (tot_fwd_pkts + tot_bwd_pkts) / (flow_duration / 1e6 + 1e-5)
        
        records.append({
            "Destination Port": dest_port,
            "Flow Duration": flow_duration,
            "Total Fwd Packets": tot_fwd_pkts,
            "Total Backward Packets": tot_bwd_pkts,
            "Total Length of Fwd Packets": tot_len_fwd,
            "Total Length of Bwd Packets": tot_len_bwd,
            "Fwd Packet Length Max": fwd_len_max,
            "Fwd Packet Length Min": fwd_len_min,
            "Fwd Packet Length Mean": fwd_len_mean,
            "Fwd Packet Length Std": fwd_len_std,
            "Bwd Packet Length Max": bwd_len_max,
            "Bwd Packet Length Min": bwd_len_min,
            "Bwd Packet Length Mean": bwd_len_mean,
            "Bwd Packet Length Std": bwd_len_std,
            "Flow Bytes/s": flow_bytes_s,
            "Flow Packets/s": flow_pkts_s,
            "Flow IAT Mean": flow_duration / (tot_fwd_pkts + 1),
            "Flow IAT Std": np.random.uniform(10, 200),
            "Flow IAT Max": flow_duration * 0.4,
            "Flow IAT Min": 1.0,
            "Fwd IAT Total": flow_duration,
            "Bwd IAT Total": 0.0,
            "Fwd Header Length": tot_fwd_pkts * 20,
            "Bwd Header Length": tot_bwd_pkts * 20,
            "Fwd Packets/s": tot_fwd_pkts / (flow_duration / 1e6 + 1e-5),
            "Bwd Packets/s": tot_bwd_pkts / (flow_duration / 1e6 + 1e-5),
            "Min Packet Length": fwd_len_min,
            "Max Packet Length": fwd_len_max,
            "Packet Length Mean": fwd_len_mean,
            "Packet Length Std": fwd_len_std,
            "FIN Flag Count": 0,
            "SYN Flag Count": 1,
            "RST Flag Count": int(np.random.choice([0, 1], p=[0.9, 0.1])),
            "PSH Flag Count": int(np.random.choice([0, 1], p=[0.4, 0.6])),
            "ACK Flag Count": int(np.random.choice([0, 1], p=[0.7, 0.3])),
            "URG Flag Count": 0,
            "Down/Up Ratio": tot_bwd_pkts / max(1, tot_fwd_pkts),
            "Average Packet Size": fwd_len_mean,
            "Init_Win_bytes_forward": int(np.random.choice([256, 1024, 2048, 65535])),
            "Init_Win_bytes_backward": 0,
            "min_seg_size_forward": 20,
            "Active Mean": 0.0,
            "Idle Mean": 0.0,
            "Label": "DDoS"
        })

    # 3. PortScan Flows (Many varied ports, tiny payload or 0, 1-2 packets, SYN only or RST)
    for _ in range(n_portscan):
        dest_port = int(np.random.randint(1, 65535))
        flow_duration = int(np.random.uniform(20, 5000))
        tot_fwd_pkts = int(np.random.choice([1, 2]))
        tot_bwd_pkts = int(np.random.choice([0, 1], p=[0.8, 0.2]))
        
        fwd_len_mean = 0.0
        fwd_len_max = 0.0
        fwd_len_min = 0.0
        fwd_len_std = 0.0
        tot_len_fwd = 0.0
        tot_len_bwd = 0.0
        
        records.append({
            "Destination Port": dest_port,
            "Flow Duration": flow_duration,
            "Total Fwd Packets": tot_fwd_pkts,
            "Total Backward Packets": tot_bwd_pkts,
            "Total Length of Fwd Packets": 0.0,
            "Total Length of Bwd Packets": 0.0,
            "Fwd Packet Length Max": 0.0,
            "Fwd Packet Length Min": 0.0,
            "Fwd Packet Length Mean": 0.0,
            "Fwd Packet Length Std": 0.0,
            "Bwd Packet Length Max": 0.0,
            "Bwd Packet Length Min": 0.0,
            "Bwd Packet Length Mean": 0.0,
            "Bwd Packet Length Std": 0.0,
            "Flow Bytes/s": 0.0,
            "Flow Packets/s": (tot_fwd_pkts + tot_bwd_pkts) / (flow_duration / 1e6 + 1e-5),
            "Flow IAT Mean": float(flow_duration),
            "Flow IAT Std": 0.0,
            "Flow IAT Max": float(flow_duration),
            "Flow IAT Min": float(flow_duration),
            "Fwd IAT Total": float(flow_duration),
            "Bwd IAT Total": 0.0,
            "Fwd Header Length": tot_fwd_pkts * 20,
            "Bwd Header Length": tot_bwd_pkts * 20,
            "Fwd Packets/s": tot_fwd_pkts / (flow_duration / 1e6 + 1e-5),
            "Bwd Packets/s": tot_bwd_pkts / (flow_duration / 1e6 + 1e-5),
            "Min Packet Length": 0.0,
            "Max Packet Length": 0.0,
            "Packet Length Mean": 0.0,
            "Packet Length Std": 0.0,
            "FIN Flag Count": 0,
            "SYN Flag Count": 1,
            "RST Flag Count": int(np.random.choice([0, 1], p=[0.7, 0.3])),
            "PSH Flag Count": 0,
            "ACK Flag Count": 0,
            "URG Flag Count": 0,
            "Down/Up Ratio": 0.0,
            "Average Packet Size": 0.0,
            "Init_Win_bytes_forward": 1024,
            "Init_Win_bytes_backward": 0,
            "min_seg_size_forward": 20,
            "Active Mean": 0.0,
            "Idle Mean": 0.0,
            "Label": "PortScan"
        })

    # 4. DoS Hulk Flows (HTTP POST flood, high packets, abnormal header/payload)
    for _ in range(n_dos):
        dest_port = 80
        flow_duration = int(np.random.uniform(50000, 3000000))
        tot_fwd_pkts = int(np.random.uniform(20, 80))
        tot_bwd_pkts = int(np.random.uniform(10, 40))
        
        fwd_len_mean = np.random.uniform(200, 450)
        tot_len_fwd = tot_fwd_pkts * fwd_len_mean
        tot_len_bwd = tot_bwd_pkts * 120.0
        
        records.append({
            "Destination Port": dest_port,
            "Flow Duration": flow_duration,
            "Total Fwd Packets": tot_fwd_pkts,
            "Total Backward Packets": tot_bwd_pkts,
            "Total Length of Fwd Packets": tot_len_fwd,
            "Total Length of Bwd Packets": tot_len_bwd,
            "Fwd Packet Length Max": 800.0,
            "Fwd Packet Length Min": 50.0,
            "Fwd Packet Length Mean": fwd_len_mean,
            "Fwd Packet Length Std": 120.0,
            "Bwd Packet Length Max": 300.0,
            "Bwd Packet Length Min": 20.0,
            "Bwd Packet Length Mean": 120.0,
            "Bwd Packet Length Std": 50.0,
            "Flow Bytes/s": (tot_len_fwd + tot_len_bwd) / (flow_duration / 1e6 + 1e-5),
            "Flow Packets/s": (tot_fwd_pkts + tot_bwd_pkts) / (flow_duration / 1e6 + 1e-5),
            "Flow IAT Mean": flow_duration / (tot_fwd_pkts + tot_bwd_pkts + 1),
            "Flow IAT Std": np.random.uniform(500, 5000),
            "Flow IAT Max": flow_duration * 0.5,
            "Flow IAT Min": 10.0,
            "Fwd IAT Total": flow_duration * 0.9,
            "Bwd IAT Total": flow_duration * 0.8,
            "Fwd Header Length": tot_fwd_pkts * 20,
            "Bwd Header Length": tot_bwd_pkts * 20,
            "Fwd Packets/s": tot_fwd_pkts / (flow_duration / 1e6 + 1e-5),
            "Bwd Packets/s": tot_bwd_pkts / (flow_duration / 1e6 + 1e-5),
            "Min Packet Length": 20.0,
            "Max Packet Length": 800.0,
            "Packet Length Mean": (tot_len_fwd + tot_len_bwd) / (tot_fwd_pkts + tot_bwd_pkts),
            "Packet Length Std": 100.0,
            "FIN Flag Count": 0,
            "SYN Flag Count": 0,
            "RST Flag Count": 0,
            "PSH Flag Count": 1,
            "ACK Flag Count": 1,
            "URG Flag Count": 0,
            "Down/Up Ratio": tot_bwd_pkts / tot_fwd_pkts,
            "Average Packet Size": (tot_len_fwd + tot_len_bwd) / (tot_fwd_pkts + tot_bwd_pkts),
            "Init_Win_bytes_forward": 29200,
            "Init_Win_bytes_backward": 29200,
            "min_seg_size_forward": 20,
            "Active Mean": 500.0,
            "Idle Mean": 1000.0,
            "Label": "DoS Hulk"
        })

    # 5. Botnet Flows (Periodic beaconing, fixed intervals, port 8080/6667)
    for _ in range(n_bot):
        dest_port = np.random.choice([8080, 6667, 4444])
        flow_duration = int(np.random.uniform(200000, 1500000))
        tot_fwd_pkts = int(np.random.uniform(6, 15))
        tot_bwd_pkts = int(np.random.uniform(4, 12))
        
        fwd_len_mean = np.random.uniform(80, 200)
        tot_len_fwd = tot_fwd_pkts * fwd_len_mean
        tot_len_bwd = tot_bwd_pkts * 90.0
        
        records.append({
            "Destination Port": dest_port,
            "Flow Duration": flow_duration,
            "Total Fwd Packets": tot_fwd_pkts,
            "Total Backward Packets": tot_bwd_pkts,
            "Total Length of Fwd Packets": tot_len_fwd,
            "Total Length of Bwd Packets": tot_len_bwd,
            "Fwd Packet Length Max": 250.0,
            "Fwd Packet Length Min": 60.0,
            "Fwd Packet Length Mean": fwd_len_mean,
            "Fwd Packet Length Std": 30.0,
            "Bwd Packet Length Max": 180.0,
            "Bwd Packet Length Min": 40.0,
            "Bwd Packet Length Mean": 90.0,
            "Bwd Packet Length Std": 25.0,
            "Flow Bytes/s": (tot_len_fwd + tot_len_bwd) / (flow_duration / 1e6 + 1e-5),
            "Flow Packets/s": (tot_fwd_pkts + tot_bwd_pkts) / (flow_duration / 1e6 + 1e-5),
            "Flow IAT Mean": flow_duration / (tot_fwd_pkts + tot_bwd_pkts + 1),
            "Flow IAT Std": np.random.uniform(20, 200),
            "Flow IAT Max": flow_duration * 0.3,
            "Flow IAT Min": 100.0,
            "Fwd IAT Total": flow_duration * 0.95,
            "Bwd IAT Total": flow_duration * 0.85,
            "Fwd Header Length": tot_fwd_pkts * 20,
            "Bwd Header Length": tot_bwd_pkts * 20,
            "Fwd Packets/s": tot_fwd_pkts / (flow_duration / 1e6 + 1e-5),
            "Bwd Packets/s": tot_bwd_pkts / (flow_duration / 1e6 + 1e-5),
            "Min Packet Length": 40.0,
            "Max Packet Length": 250.0,
            "Packet Length Mean": (tot_len_fwd + tot_len_bwd) / (tot_fwd_pkts + tot_bwd_pkts),
            "Packet Length Std": 45.0,
            "FIN Flag Count": 0,
            "SYN Flag Count": 1,
            "RST Flag Count": 0,
            "PSH Flag Count": 1,
            "ACK Flag Count": 1,
            "URG Flag Count": 0,
            "Down/Up Ratio": tot_bwd_pkts / tot_fwd_pkts,
            "Average Packet Size": (tot_len_fwd + tot_len_bwd) / (tot_fwd_pkts + tot_bwd_pkts),
            "Init_Win_bytes_forward": 8192,
            "Init_Win_bytes_backward": 8192,
            "min_seg_size_forward": 20,
            "Active Mean": 120.0,
            "Idle Mean": 8000.0,
            "Label": "Bot"
        })
        
    df = pd.DataFrame(records)
    # Shuffle dataset
    df = df.sample(frac=1.0, random_state=42).reset_index(drop=True)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"Generated {len(df)} records at {output_path}")
    print(df['Label'].value_counts())

if __name__ == "__main__":
    generate_cicids2017_sample(str(DATASET_RAW_DIR / "cicids2017_sample.csv"))
