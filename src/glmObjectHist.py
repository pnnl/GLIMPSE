import glm
import matplotlib.pyplot as plt

file = "/Users/mend166/Desktop/MainProj/data/IEEE-123_Dynamic_fixed.glm"

data = glm.load(file)
objects = data["objects"]
names = []

for obj in objects:
    name = (obj["name"].split(":")[0])
    names.append(name)
    
values, bins, bars = plt.hist(names, bins=17, linewidth=0.5, edgecolor="white")

plt.xlabel("Objects")
plt.xticks(rotation="vertical")
plt.ylabel("Count")
plt.title("Number of Objects")
plt.bar_label(bars, fontsize = 12, color="navy")
plt.show()

 