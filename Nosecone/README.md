## Nose Cone Design

The primary purpose of the nose cone is to reduce aerodynamic drag by streamlining the rocket and allowing airflow to move smoothly around the body during flight. By minimizing air resistance, the nose cone improves aerodynamic efficiency, enhances stability, and enables the rocket to reach greater speeds and altitudes. Additionally, an optimized nose cone reduces turbulence and pressure buildup at the front of the rocket, decreasing overall energy loss as the rocket travels through the atmosphere.

---

## Design Decisions and Modifications

* A **length-to-diameter ratio of 10:3.27** was selected, which falls within the optimal range for subsonic flight and minimizes pressure drag.
* For manufacturing purposes, the nose cone length was adjusted to **9 inches**. When 3D printing, thicker wall sections were used and later sanded to eliminate surface irregularities caused by visible print layer lines, resulting in a smoother aerodynamic surface.
* The **coefficient of drag (Cd)** was analyzed, recognizing that it is influenced by both velocity and geometry. The nose cone was designed in CAD and imported into **ANSYS** for aerodynamic simulation to evaluate its drag characteristics.
* Flow **pathline simulations** were generated to visualize airflow behavior around the nose cone and confirm smooth, attached flow.
* The final geometry was chosen as an **elliptical (ellipsoid) nose cone**, which was calculated to be the most aerodynamically efficient shape for the expected subsonic flight regime.

---

## Attachments

* An **MP4 animation** showing airflow pathlines around the nose cone from the ANSYS simulation
* A **3D CAD file** of the finalized ellipsoid-shaped nose cone

---
