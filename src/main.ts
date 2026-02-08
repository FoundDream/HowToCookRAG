import DataPreparation from "./modules/data_preparation";
import { dataPath } from "./config";

const dataPreparation = new DataPreparation(dataPath);
dataPreparation.loadDocuments();
dataPreparation.chunkDocuments();
