import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

print("🚀 Training Started...")

# Load data and labels from the IDS Datasets folder
data_df = pd.read_csv("IDS Datasets/IDS DATASET/CIC UNSW-NB15 Augmented Dataset/Data.csv")
label_df = pd.read_csv("IDS Datasets/IDS DATASET/CIC UNSW-NB15 Augmented Dataset/Label.csv")

# Combine data with labels
df = pd.concat([data_df, label_df], axis=1)
print("✅ Dataset Loaded")
print("Shape:", df.shape)

X = df.iloc[:, :-1]
y = df.iloc[:, -1]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

model = RandomForestClassifier(n_estimators=200)
model.fit(X_train_scaled, y_train)

y_pred = model.predict(X_test_scaled)
acc = accuracy_score(y_test, y_pred)

print("🎉 Training Completed!")
print("📌 Accuracy:", acc)

joblib.dump(model, "model/ids_model.pkl")
joblib.dump(scaler, "model/scaler.pkl")

print("💾 Saved: model/ids_model.pkl & scaler.pkl")
