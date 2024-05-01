import "@kitware/vtk.js/Rendering/OpenGL/Profiles/All";
import "@kitware/vtk.js/IO/Core/DataAccessHelper/HtmlDataAccessHelper";
import "@kitware/vtk.js/IO/Core/DataAccessHelper/JSZipDataAccessHelper";

import DataAccessHelper from "@kitware/vtk.js/IO/Core/DataAccessHelper";
import vtkFullScreenRenderWindow from "@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow";
import vtkSynchronizableRenderWindow from "@kitware/vtk.js/Rendering/Misc/SynchronizableRenderWindow";

const res = await fetch("./test.vtksz");
const file = await res.blob();

const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
  background: [1, 1, 1],
  rootContainer: document.body,
  containerStyle: { height: "100%", width: "100%", position: "fixed" },
});

const renderWindow = fullScreenRenderer.getRenderWindow();
const syncCTX = vtkSynchronizableRenderWindow.getSynchronizerContext();
const syncRW = vtkSynchronizableRenderWindow.decorate(renderWindow);

const dataAccessHelper = DataAccessHelper.get("zip", {
  zipContent: file,
  callback: (zip) => {
    dataAccessHelper.fetchJSON(null, "index.json").then((data) => {
      syncCTX.setFetchArrayFunction((sha) =>
        Promise.resolve(data.hashes[sha].content)
      );
      console.log(data.scene);
      syncRW.synchronize(data.scene);
      syncRW.render();
    });
  },
});
