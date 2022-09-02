import glm
import pandas as pd
import matplotlib.pyplot as plt

# file1 = "/Users/mend166/Desktop/MainProj/data/IEEE-123_Dynamic_fixed.glm"
# file2 = "/Users/mend166/Desktop/MainProj/data/IEEE-123_Diesels_fixed.glm"
# file3 = "/Users/mend166/Desktop/MainProj/data/IEEE-123_Inverters_fixed.glm"

file1 =  "data/9500/IEEE_9500.glm"
file2 = "data/9500/Inverters.glm"
file3 = "data/9500/Rotating_Machines.glm"

dynamic = glm.load(file1)
diesels = glm.load(file2)
inverters = glm.load(file3)
dynamic_objects = dynamic["objects"]
diesels_objects = diesels["objects"]
inverters_objects = inverters["objects"]

names = []

for obj in dynamic_objects:
    name = (obj["name"])
    names.append(name)

for obj in diesels_objects:
    name = (obj["name"])
    names.append(name)

for obj in inverters_objects:
    name = (obj["name"])
    names.append(name)

df = pd.DataFrame(names, columns=["Objects"])
df["Frequency"] = df.groupby("Objects")["Objects"].transform("count")
df1 = df.groupby('Objects').count()
df1.sort_values(by=["Frequency"], ascending = False).to_csv("output/objects.csv")
df2 = pd.read_csv("output/objects.csv")
print(df2)