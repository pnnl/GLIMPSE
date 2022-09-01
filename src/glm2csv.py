import glm
import pandas as pd
import matplotlib.pyplot as plt

file1 = "/Users/mend166/Desktop/MainProj/data/IEEE-123_Dynamic_fixed.glm"
file2 = "/Users/mend166/Desktop/MainProj/data/IEEE-123_Diesels_fixed.glm"
file3 = "/Users/mend166/Desktop/MainProj/data/IEEE-123_Inverters_fixed.glm"

dynamic = glm.load(file1)
diesels = glm.load(file2)
inverters = glm.load(file3)
dynamic_objects = dynamic["objects"]
diesels_objects = diesels["objects"]
inverters_objects = inverters["objects"]

names = []

for obj in dynamic_objects:
    name = (obj["name"].split(":")[0])
    names.append(name)

for obj in diesels_objects:
    name = (obj["name"])
    names.append(name)

for obj in inverters_objects:
    name = (obj["name"].split(":")[0])
    names.append(name)

df = pd.DataFrame(names, columns=["Objects"])
df["Frequency"] = df.groupby("Objects")["Objects"].transform("count")
df1 = df.groupby('Objects').count()
df1.sort_values(by=["Frequency"], ascending = False).to_csv("C:/Users/mend166/Desktop/MainProj/output/objects.csv")
df2 = pd.read_csv("/Users/mend166/Desktop/MainProj/output/objects.csv")
print(df2)