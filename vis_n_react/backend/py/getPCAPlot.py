import pandas as pd
import numpy as np
import sys
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt

def plot_emb(fname, titlestr = "2 Component PCA", dataannotation=False):
   nemb = pd.read_csv(fname, header=None)
   lbl = nemb[0].tolist()

   pca = PCA(n_components=2)
   principalComponents = pca.fit_transform(nemb)
   principalDf = pd.DataFrame(data = principalComponents, columns = ['principal component 1', 'principal component 2'])

   # print(principalDf)

   fig = plt.figure(figsize = (16,16))
   ax = fig.add_subplot(1,1,1) 
   ax.set_xlabel('Principal Component 1', fontsize = 15)
   ax.set_ylabel('Principal Component 2', fontsize = 15)
   ax.set_title(titlestr, fontsize = 20)
   ax.scatter(principalDf['principal component 1'],principalDf['principal component 2'],s=100)
   
   if dataannotation:
      for i, txt in enumerate(lbl):
         ax.annotate(txt, (principalDf['principal component 1'][i]+.02, principalDf['principal component 2'][i]), fontsize=20)
      ax.grid()
   fig.savefig('./figs/plot.png')


def main():
   plot_emb(sys.argv[1],titlestr = "ITeM embeddings of current model")

if __name__ == "__main__":
   main()