'''
Created on Oct 11, 2013

@author: kpaskov
'''
from abc import abstractmethod, ABCMeta

class FrontendInterface(metaclass=ABCMeta):
    @abstractmethod
    def get_renderer(self, method_name):
        return None
    
    #Response
    @abstractmethod
    def response_wrapper(self, method_name, request):
        return None
    
    #Redirect
    @abstractmethod
    def redirect(self, page, params):
        return None
        
    @abstractmethod
    def go(self, biocon_repr):
        return None

    @abstractmethod
    def go_ontology(self, bioent_repr):
        return None
            
    @abstractmethod
    def observable(self, biocon_repr):
        return None
    
    @abstractmethod
    def phenotype_ontology(self):
        return None
    
    @abstractmethod
    def chemical(self, chemical_repr):
        return None

    @abstractmethod
    def domain(self, domain_repr):
        return None

    @abstractmethod
    def contig(self, contig_repr):
        return None
        
    @abstractmethod
    def author(self, author_repr):
        return None
        
    @abstractmethod
    def header(self):
        return None
    
    @abstractmethod    
    def footer(self):  
        return None  
    
    @abstractmethod    
    def download_table(self, response, header_info, data, display_name):
        return None
     
    @abstractmethod   
    def download_citations(self, response, reference_ids, display_name):
        return None

    @abstractmethod
    def download_sequence(self, response, sequence, display_name, contig_name):
        return None
      
    @abstractmethod  
    def analyze(self, list_name, bioent_ids):
        return None
       
    @abstractmethod 
    def enrichment(self, bioent_ids):
        return None
