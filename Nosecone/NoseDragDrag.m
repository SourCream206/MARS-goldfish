L = input('Input nose length');
R = input('Input Base Radius');
V = input('Input max velocity');
rho = 1.225;      
mu = 1.8e-5;       
a = 343;  
M=V/a;

x=linspace(0,L,300);

Re = rho*V*x/mu;
Re(1)=Re(2); %avoids div by 0 and close enough approx
D_ellip = NoseCone(R,L,x,1,0,rho,Re,V);

D_ogive = NoseCone(R,L,x,2,0,rho,Re,V);

D_para = NoseCone(R,L,x,3,1.5,rho,Re,V);

D_haack = NoseCone(R,L,x,4,0,rho,Re,V);

%Find best K between Quintic and Sqrt
k_opt = fminbnd(@(k) NoseCone(R,L,x,3,k,rho,Re,V),0.5,4);
D_optpara = NoseCone(R,L,x,3,k_opt,rho,Re,V);
fprintf('Elliptical Drag: %f N\n',D_ellip)
fprintf('Ogive Drag: %f N\n',D_ogive)
fprintf('Parabolic Drag: %f N, best %f with %f N \n',D_para, k_opt, D_optpara)
fprintf('Haack Drag: %f N\n',D_haack)