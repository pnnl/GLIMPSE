#!/usr/bin/env python
# coding: utf-8

# In[55]:


import pandas as pd
import matplotlib.pyplot as plt
import pandas
import re
import matplotlib.cm as cm
import glob 
import json
import numpy as np
import sys
from sklearn import preprocessing
# Importing Modules
from sklearn import datasets
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA


# In[24]:


def get_emb_list_from_json_row(json_row):
    row=[]
    for (k, v) in json_row.items():
            if isinstance(v, list):
                row.extend(v)
            else:
                row.append(v)
    return row


# In[25]:


# it returns a dictionary that tells for which iter,w,motif/orbitid => nuber of nodes
def get_num_v_association(filePath):
    itr_w_dict = {}
    with open(filePath) as infile:
        for line in infile:
            larr = line.rstrip().split(",")
            if len(larr) == 2:
                #first line
                itr_w_dict['n_itr'] = larr[0]
                itr_w_dict['n_w'] = larr[1]
            else:    
                #first 3 entries are ir,w,motifid/orbitid. rest are vertex
                num_v = len(larr) - 3
                itr_w_dict["_".join(larr[0:3])] = num_v
    return itr_w_dict


# In[26]:


def get_3rd_entry_ind(filePath):
    itr_w_dict = {}
    curr_itr,curr_w = -1,-1
    with open(filePath) as infile:
        for line in infile:
            line = line.rstrip()
            if line.startswith("#"):
                # should improve
                # #num_total_motif,num_ind_motif,motif_independence_0_0
                larr = line.split(",")
                curr_itr = larr[-1].split("_")[-2]
                curr_w = larr[-1].split("_")[-1]
                continue
            larr = line.rstrip().split(",")
            if len(larr) == 2:
                #first line that list total number of iterations and windows in this file
                itr_w_dict['n_itr'] = larr[0]
                itr_w_dict['n_w'] = larr[1]
            else:
                key = "_".join([str(curr_itr),str(curr_w)])
                curr_list = itr_w_dict.get(key,[])
                curr_list.append(float(larr[2]))
                itr_w_dict[key] = curr_list
    return itr_w_dict            
                   
    


# In[ ]:





# In[27]:


def initialize_local_dict(n_itr,n_w,size):
    local_dict = {}
    for i in range(n_itr):
        for j in range(n_w):
            key="_".join([str(i),str(j)])
            local_dict[key] = [0] * size
    return local_dict

def update_global_dict(local_dict, g_emb_dict):
    #now we have local dict, update the g_emb_dict
    for k,v in local_dict.items():
        emb = g_emb_dict.get(k,[])
        emb.extend(v)
        g_emb_dict[k] = emb
    return g_emb_dict


# In[28]:


def add_embedding_from_JSON(jons_entries,g_emb_dict):
    for row in jons_entries:
        row_emb = get_emb_list_from_json_row(row)
        itr = row_emb[0]
        w = row_emb[1]
        key="_".join([str(itr),str(w)])
        existing_list = g_emb_dict.get(key,[])
        existing_list.extend(row_emb)
        g_emb_dict[key] = existing_list
        #g_embedding.extend()
    return g_emb_dict


# In[29]:


def read_ind_file(filePath,g_emb_dict,TOTAL_MOTIF_ORBIT):
    itr_w_dict = get_3rd_entry_ind(filePath)
    n_itr = int(itr_w_dict['n_itr'])
    n_w = int(itr_w_dict['n_w'])
    del itr_w_dict['n_itr']
    del itr_w_dict['n_w']
    
     #initialize local dict with zero values for each 
    local_dict = initialize_local_dict(n_itr,n_w,TOTAL_MOTIF_ORBIT)
    
    g_emb_dict = update_global_dict(itr_w_dict,g_emb_dict)
    return g_emb_dict
    


# In[30]:


def read_association_file(filePath,g_emb_dict,TOTAL_MOTIF_ORBIT):
    #get motif associaation from motif 0 to 15 (total 16 motif). if no value, then put zero
    # it has one line for each association in every ir, w
    itr_w_dict = get_num_v_association(filePath)
    n_itr = int(itr_w_dict['n_itr'])
    n_w = int(itr_w_dict['n_w'])
    del itr_w_dict['n_itr']
    del itr_w_dict['n_w']

    #initialize local dict with zero values for each 
    local_dict = initialize_local_dict(n_itr,n_w,TOTAL_MOTIF_ORBIT)
    for itr_w_id,num_v in itr_w_dict.items():
        itr , w ,mid = itr_w_id.split("_")[0], itr_w_id.split("_")[1], int(itr_w_id.split("_")[2])
        key="_".join([str(itr),str(w)])
        existing_list = local_dict.get(key)
        #assert len(exiting_list)==54,"ITeM_Freq emebdding are not of size 54"
        existing_list[int(mid)] = num_v
        local_dict[key] = existing_list

    g_emb_dict = update_global_dict(local_dict,g_emb_dict)
    return g_emb_dict


# In[75]:


def get_graph_embeddings(inputpath,graph_emb_input_files):
    print("# Generating Graph Embeddings Using Following Files#")
    TOTAL_MOTIF = 16
    TOTAL_ORBIT = 29
    g_emb_dict={}
    for f in graph_emb_input_files:
        print(f)
        filePath = glob.glob(inputpath+"/"+f)[0]
        print(filePath)
        if f == "*ITeM_Freq.txt":
            item_freq = json.load(open(filePath))
            g_emb_dict = add_embedding_from_JSON(item_freq,g_emb_dict)
        
        if f == "*Offset_AbsCount.txt":
            offset_row = json.load(open(filePath))
            # TODO: proper json
            g_emb_dict = add_embedding_from_JSON(offset_row,g_emb_dict)
            
        if f == "*Motif_Association*":
            g_emb_dict = read_association_file(filePath,g_emb_dict,TOTAL_MOTIF)

        if f == "*Orbit_Association.txt":
            g_emb_dict = read_association_file(filePath,g_emb_dict,TOTAL_ORBIT)
            
        if f == "*Motif_Ind.txt":
            #get motif indepe from motif 0 to 15 (total 16 motif). if no value, then put 0
            # it has one line for each in , 3 enries, 3rd is ind
            #initialize local dict with zero values for each 
            g_emb_dict = read_ind_file(filePath,g_emb_dict,TOTAL_MOTIF)
            
        if f == "*Vertex_Ind.txt":
            g_emb_dict = read_ind_file(filePath,g_emb_dict,TOTAL_MOTIF)  

        if f == "*Offset_RateAvg.txt":
            # every line is one entry
            local_emb = []
            with open(filePath) as infile:
                for line in infile:
                    local_emb.append(float(line.rstrip()))
            curr_emb = g_emb_dict.get("avg",[])
            curr_emb.extend(local_emb)
            g_emb_dict["avg"] = curr_emb
        
        if f == "*ITeM_RateAvg.txt":
            local_emb = []
            with open(filePath) as infile:
                for line in infile:
                    if line == '': 
                        continue
                    local_emb.append(float(line.rstrip()))
            curr_emb = g_emb_dict.get("avg",[])
            curr_emb.extend(local_emb)
            g_emb_dict["avg"] = curr_emb
        
        #TODO many errors in json file
        """
        if f == "*Orbit_Ind.txt":
            orbit_ind_json_row = json.load(open(filePath))
            g_embedding.extend(get_emb_list_from_json_row(orbit_ind_json_row))
            # TODO: proper json

        """
    # fill zero for na, change everything to float
    return pd.DataFrame.from_dict(g_emb_dict).transpose().fillna(0)
    


# In[49]:


def df_kmean(df,k):
    # Importing Modules
    from sklearn import datasets
    from sklearn.cluster import KMeans
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import MinMaxScaler

    #clust_labels = kmeans.predict(state_feature_vector)
    model = KMeans (n_clusters=k)
    preds = model.fit_predict(df)
    centers = model.cluster_centers_

    #plot hist of centers
    plt.hist(model.labels_)

    #pca to visulize
    pca = PCA(n_components=2)
    principalComponents = pca.fit_transform(df)
    principalDf = pd.DataFrame(data = principalComponents
                 , columns = ['PC1', 'PC2'])
    centers_pca = pca.fit_transform(centers)
    centers_pca_df = pd.DataFrame(data = centers_pca
                 , columns = ['PC1', 'PC2'])

    fig, ax = plt.subplots(figsize=(10,10),dpi=80)
    ax.scatter(principalDf['PC1'], principalDf['PC2'], c=preds, s=50, cmap='viridis')
    ax.scatter(centers_pca_df['PC1'], centers_pca_df['PC2'], c='magenta', s=200, alpha=0.5);

    for i, txt in enumerate(df.index.to_list()):
        print(txt)
        ax.annotate(str(txt).replace("US, ",""), (principalDf.loc[i,'PC1'], principalDf.loc[i,'PC2']))

    

        


# In[11]:


def df_elbow():
    # elbow analysis
    mms = MinMaxScaler()
    mms.fit(graph_emb)
    data_transformed = mms.transform(graph_emb)
    Sum_of_squared_distances = []
    K = range(1,10)
    for k in K:
        km = KMeans(n_clusters=k)
        km = km.fit(data_transformed)
        Sum_of_squared_distances.append(km.inertia_)
    plt.plot(K, Sum_of_squared_distances, 'bx-')
    plt.xlabel('k')
    plt.ylabel('Sum_of_squared_distances')
    plt.title('Elbow Method For Optimal k')
    plt.show()
    


# In[12]:


# get node embeddings
def get_node_embedding(inputpath,graph_emb_input_files):
    print("# Generating Node Embeddings Using Following Files#")
    for f in graph_emb_input_files:
        print(f)
        filePath = glob.glob(inputpath+"/"+f)[0]
        
        if f == "*Vertex_Orbit_Frequency*":
            vof = pd.read_csv(filePath,header=None,index_col=2,dtype=np.float64)
            
        if f == "*Vertex_ITeM_Frequency*":
            vif = pd.read_csv(filePath,header=None,index_col=2,dtype=np.float64)
            
    
    #outer join
    result = pd.concat([vof, vif], axis=1, sort=False).fillna(0)
    
    return result


# In[74]:


# emebedding file lists:  
graph_emb_input_files = ["*ITeM_Freq.txt" , "*Motif_Association*",
                         "*Motif_Ind.txt", "*Offset_AbsCount.txt", "*Orbit_Association.txt",
                         "*Orbit_Ind.txt", "*Vertex_Ind.txt"]
graph_avg_emb_input_files = ["*ITeM_RateAvg.txt"] #,"*Offset_RateAvg.txt"
node_emb_input_files = ["*Vertex_Orbit_Frequency*","*Vertex_ITeM_Frequency*"]


# In[ ]:


def main():
    print("### Generating Graph and Node Embeddings ###\n")
    inputpath = sys.argv[1]
    outpath = sys.argv[2]
    
    graph_emb = get_graph_embeddings(inputpath,graph_emb_input_files)
    graph_emb.to_csv(outpath+"graph.emb",header=False)
    
    #write node emb and node_mean emb
    filePath = glob.glob(inputpath+"/*nodeMap.txt")[0]
    node_map = {}
    with open(filePath) as infile:
        for line in infile:
            larr = line.rstrip().split(",")
            node_map[int(larr[0])] = larr[1]
    
    node_emb = get_node_embedding(inputpath,node_emb_input_files)
    #change node id to node label
    #node_emb.iloc[:,1] = node_emb.iloc[:,1].apply(lambda vid: node_map[str(int(vid))])
    node_emb = node_emb.rename(index=node_map)
    node_emb.columns = range(len(node_emb.columns))
    node_emb.to_csv(outpath+"node.emb",header=False)
    
    # normalized node embeddings
    min_max_scaler = preprocessing.MinMaxScaler()
    np_scaled = min_max_scaler.fit_transform(node_emb)
    df_normalized = pd.DataFrame(np_scaled, columns = node_emb.columns, index = node_emb.index)
    df_normalized.iloc[:,0] = node_emb.iloc[:,0] # it is itr id
    df_normalized.iloc[:,1] = node_emb.iloc[:,1] # it is the window id
    df_normalized.to_csv(outpath+"node_norm.emb",header=False)
    
    #node_emb_mean = node_emb.groupby(node_emb.columns[1]).mean() #col id 1 has node label
    node_emb_mean = node_emb.groupby(node_emb.index).mean() #index name is the v label
    node_emb_mean.to_csv(outpath+"node_mean.emb",header=False)
    
    graph_emb_mean = get_graph_embeddings(inputpath,graph_avg_emb_input_files)
    #join mean of window emb and avg emv. mean returns a Series so get df and transpose it
    g_win_mean = graph_emb.mean() 
    g_mean = g_win_mean.append(graph_emb_mean.mean())
    g_mean_df = g_mean.to_frame().transpose()
    g_mean_df.to_csv(outpath+"graph_mean.emb",header=False)
    
if __name__ == "__main__":
    main()


# In[77]:


#inputpath = "D:/localcode/STM/out_real_usa_upAug/"


# In[50]:


# #graph_emb = get_graph_embeddings(inputpath,graph_emb_input_files)
# #graph_emb_mean = get_graph_embeddings(inputpath,graph_avg_emb_input_files)
# #write node emb and node_mean emb
# node_map = {}
# with open(inputpath+"/nodeMap.txt") as infile:
#     for line in infile:
#         larr = line.rstrip().split(",")
#         node_map[int(larr[0])] = larr[1]

# node_emb = get_node_embedding(inputpath,node_emb_input_files)
# #change node id to node label
# #node_emb.iloc[:,1] = node_emb.iloc[:,1].apply(lambda vid: node_map[str(int(vid))])
# node_emb = node_emb.rename(index=node_map)
# node_emb.columns = range(len(node_emb.columns))


# In[72]:


# model = KMeans (n_clusters=3)
# preds = model.fit_predict(node_emb)
# centers = model.cluster_centers_
# labels = model.labels_
# st_cluster_dict = {}
# for i, txt in enumerate(node_emb.index.to_list()):
#         st_cluster_dict[txt.replace("US","").strip()] = labels[i]
# print(st_cluster_dict)


# In[51]:


#df_kmean(node_emb,3)


# In[201]:


#grp = node_emb.groupby(node_emb.index).mean()


# In[202]:


#grp


# In[212]:


# inputpath = "D:/localcode/STM/tmp_emb_input/"
# node_map = {}
# with open(inputpath+"/nodeMap.txt") as infile:
#     for line in infile:
#         larr = line.rstrip().split(",")
#         node_map[int(larr[0])] = larr[1]

# node_emb = get_node_embedding(inputpath,node_emb_input_files)
# #change node id to node label
# #node_emb.iloc[:,1] = node_emb.iloc[:,1].apply(lambda vid: node_map[str(int(vid))])
# node_emb = node_emb.rename(index=node_map)
# node_emb.columns = range(len(node_emb.columns))
# #node_emb.to_csv(outpath+"node.emb",header=False)


# In[219]:


# min_max_scaler = preprocessing.MinMaxScaler()
# np_scaled = min_max_scaler.fit_transform(node_emb)
# df_normalized = pd.DataFrame(np_scaled, columns = node_emb.columns, index = node_emb.index)
# df_normalized


# In[222]:


# df_normalized.iloc[:,0] = node_emb.iloc[:,0]
# df_normalized.iloc[:,1] = node_emb.iloc[:,1]
# df_normalized


# In[213]:


#node_emb


# In[136]:


# vif = pd.read_csv("D://localcode//STM/699287329224529_Vertex_ITeM_Frequency.txt",header=None)
# nm = pd.read_csv("D://localcode//STM/nodeMap.txt",header=None)
# vifs = set(vif[2].to_list())
# print(len(vifs))
# nms = set(nm[0].to_list())
# print(len(nms))
# diff = nms.difference(vifs)
# print(len(diff))


# In[ ]:





# In[135]:


# diff


# In[91]:


# tt = pd.read_csv("D://localdata/kdd_tech-as-topology.csv",header=None)


# In[99]:


# v_s = set(tt[0])
# v_d = set(tt[2])
# print(len(v_s))
# print(len(v_d))


# In[101]:


# totalv = v_s.union(v_d)
# print(len(totalv))


# In[ ]:




